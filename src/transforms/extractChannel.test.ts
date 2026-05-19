import { describe, expect, it } from 'vitest';
import type { Channel, RasterImage } from '../formats/types';
import { extractChannelAsGrayscale } from './extractChannel';

function makeImage(channels: Channel[], pixels: number[]): RasterImage {
  const buf = new Uint8ClampedArray(pixels.length);
  buf.set(pixels);
  return {
    width: pixels.length / 4,
    height: 1,
    pixels: buf,
    meta: { format: 'png', bitDepth: 8, channels },
  };
}

describe('extractChannelAsGrayscale', () => {
  const img = makeImage(['R', 'G', 'B', 'A'], [10, 20, 30, 100, 200, 50, 75, 250]);

  it('extracts R as grayscale', () => {
    expect([...extractChannelAsGrayscale(img, 'R')]).toEqual([10, 10, 10, 255, 200, 200, 200, 255]);
  });

  it('extracts G as grayscale', () => {
    expect([...extractChannelAsGrayscale(img, 'G')]).toEqual([20, 20, 20, 255, 50, 50, 50, 255]);
  });

  it('extracts B as grayscale', () => {
    expect([...extractChannelAsGrayscale(img, 'B')]).toEqual([30, 30, 30, 255, 75, 75, 75, 255]);
  });

  it('extracts A as grayscale (the transparency mask)', () => {
    expect([...extractChannelAsGrayscale(img, 'A')]).toEqual([100, 100, 100, 255, 250, 250, 250, 255]);
  });

  it('treats Gray as R (since R=G=B for grayscale-decoded images)', () => {
    const gray = makeImage(['Gray'], [128, 128, 128, 255]);
    expect([...extractChannelAsGrayscale(gray, 'Gray')]).toEqual([128, 128, 128, 255]);
  });
});
