import type { RasterImage } from '../types';

/**
 * Encode a RasterImage to PNG or JPEG via the browser's canvas pipeline.
 * Quality is only meaningful for JPEG and is clamped to [0, 1].
 */
export async function encodeBrowser(
  image: RasterImage,
  format: 'png' | 'jpeg',
  quality?: number,
): Promise<Blob> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');

  const imageData = new ImageData(image.pixels, image.width, image.height);
  ctx.putImageData(imageData, 0, 0);

  const type = format === 'png' ? 'image/png' : 'image/jpeg';
  const blobOpts: ImageEncodeOptions = { type };
  if (format === 'jpeg' && typeof quality === 'number') {
    blobOpts.quality = Math.max(0, Math.min(1, quality));
  }

  return canvas.convertToBlob(blobOpts);
}
