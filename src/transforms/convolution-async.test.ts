import { describe, expect, it } from 'vitest';
import type { Channel, RasterImage } from '../formats/types';
import { applyConvolution, IDENTITY_KERNEL, type Kernel3x3 } from './convolution';
import { applyConvolutionAsync, ConvolutionAbortError } from './convolution-async';

function makeImage(width: number, height: number, fill: [number, number, number, number] = [50, 100, 150, 255]): RasterImage {
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    buf[i * 4] = fill[0];
    buf[i * 4 + 1] = fill[1];
    buf[i * 4 + 2] = fill[2];
    buf[i * 4 + 3] = fill[3];
  }
  return {
    width,
    height,
    pixels: buf,
    meta: { format: 'png', bitDepth: 8, channels: ['R', 'G', 'B', 'A'] },
  };
}

const SHARPEN: Kernel3x3 = [0, -1, 0, -1, 5, -1, 0, -1, 0];
const ALL: ReadonlySet<Channel> = new Set(['R', 'G', 'B', 'A']);

describe('applyConvolutionAsync', () => {
  it('short-circuits identity', async () => {
    const img = makeImage(20, 20);
    const out = await applyConvolutionAsync(img, {
      kernel: IDENTITY_KERNEL,
      channels: ALL,
      edgeMode: 'clamp',
    });
    expect(out).toBe(img);
  });

  it('produces byte-identical output to the sync path', async () => {
    const img = makeImage(20, 15);
    const params = { kernel: SHARPEN, channels: ALL, edgeMode: 'clamp' as const };
    const syncOut = applyConvolution(img, params);
    const asyncOut = await applyConvolutionAsync(img, params, {
      syncThresholdPixels: 0,
      chunkRows: 4,
    });
    expect([...asyncOut.pixels]).toEqual([...syncOut.pixels]);
  });

  it('reports progress that ends at 1.0', async () => {
    const img = makeImage(20, 32);
    const progresses: number[] = [];
    await applyConvolutionAsync(img, {
      kernel: SHARPEN,
      channels: ALL,
      edgeMode: 'clamp',
    }, {
      syncThresholdPixels: 0,
      chunkRows: 8,
      onProgress: (p) => progresses.push(p),
    });
    expect(progresses.length).toBeGreaterThan(1);
    expect(progresses.at(-1)).toBe(1);
    expect(progresses.every((p) => p > 0 && p <= 1)).toBe(true);
  });

  it('throws ConvolutionAbortError when the signal is aborted before start', async () => {
    const img = makeImage(20, 20);
    const controller = new AbortController();
    controller.abort();
    await expect(
      applyConvolutionAsync(img, {
        kernel: SHARPEN,
        channels: ALL,
        edgeMode: 'clamp',
      }, {
        signal: controller.signal,
        syncThresholdPixels: 0,
      }),
    ).rejects.toBeInstanceOf(ConvolutionAbortError);
  });

  it('takes the sync fast-path for small images', async () => {
    // 10×10 = 100 px, well under SYNC_THRESHOLD_PIXELS — onProgress never
    // fires because the chunked loop is skipped entirely.
    const img = makeImage(10, 10);
    let progressFired = false;
    await applyConvolutionAsync(img, {
      kernel: SHARPEN,
      channels: ALL,
      edgeMode: 'clamp',
    }, {
      onProgress: () => {
        progressFired = true;
      },
    });
    expect(progressFired).toBe(false);
  });
});
