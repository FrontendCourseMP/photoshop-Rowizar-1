import type { RasterImage } from '../formats/types';
import {
  applyConvolution,
  applyConvolutionRows,
  isIdentityKernel,
  type ConvolutionParams,
} from './convolution';

/**
 * Pixel count below which we run the sync path. Yielding to the event loop
 * costs more than the convolution itself on small images — instant feedback
 * matters more than UI responsiveness when the whole operation is under a
 * millisecond.
 */
const SYNC_THRESHOLD_PIXELS = 1_000_000;

export class ConvolutionAbortError extends Error {
  constructor() {
    super('Convolution was aborted');
    this.name = 'ConvolutionAbortError';
  }
}

export type ConvolutionAsyncOptions = {
  signal?: AbortSignal;
  /** Called between chunks with a fraction in [0, 1]. The final 1.0 is
   *  always reported on the last chunk. */
  onProgress?: (progress: number) => void;
  /** Rows processed per chunk. Larger = faster total time, smaller = more
   *  responsive UI. 64 is a tuned default for 3×3 kernels. */
  chunkRows?: number;
  /** Force-async threshold override (only used by tests to skip the sync
   *  short-circuit on small images). */
  syncThresholdPixels?: number;
};

/**
 * Apply a convolution kernel without blocking the main thread for too long.
 *
 * For images below SYNC_THRESHOLD_PIXELS we just run synchronously: the cost
 * of yielding outweighs the gain. For larger images we walk the output in
 * row chunks, yielding to the event loop after each one so the browser can
 * repaint, dispatch input events and process AbortSignal aborts.
 */
export async function applyConvolutionAsync(
  image: RasterImage,
  params: ConvolutionParams,
  options: ConvolutionAsyncOptions = {},
): Promise<RasterImage> {
  if (options.signal?.aborted) throw new ConvolutionAbortError();
  if (isIdentityKernel(params.kernel)) return image;

  const totalPixels = image.width * image.height;
  const threshold = options.syncThresholdPixels ?? SYNC_THRESHOLD_PIXELS;
  if (totalPixels < threshold) {
    return applyConvolution(image, params);
  }

  const { signal, onProgress, chunkRows = 64 } = options;
  const out = new Uint8ClampedArray(image.width * image.height * 4);

  for (let y = 0; y < image.height; y += chunkRows) {
    if (signal?.aborted) throw new ConvolutionAbortError();
    const yEnd = Math.min(y + chunkRows, image.height);
    applyConvolutionRows(image, params, out, y, yEnd);
    onProgress?.(yEnd / image.height);
    if (yEnd < image.height) {
      // setTimeout(0) is enough to give the event loop a turn — pointer
      // events, paint and Abort callbacks all get a chance to run.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return {
    width: image.width,
    height: image.height,
    pixels: out,
    meta: image.meta,
  };
}
