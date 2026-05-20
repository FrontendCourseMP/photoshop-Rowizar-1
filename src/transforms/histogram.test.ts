import { describe, expect, it } from 'vitest';
import type { Channel, RasterImage } from '../formats/types';
import { computeHistogram } from './histogram';

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

function nonZeroBins(h: Uint32Array): Record<number, number> {
  const out: Record<number, number> = {};
  for (let i = 0; i < h.length; i++) {
    const v = h[i]!;
    if (v > 0) out[i] = v;
  }
  return out;
}

describe('computeHistogram', () => {
  it('returns a 256-entry array', () => {
    const img = makeImage(['R', 'G', 'B', 'A'], [0, 0, 0, 255]);
    expect(computeHistogram(img, 'R').length).toBe(256);
  });

  it('counts pure black on all channels into bin 0', () => {
    const img = makeImage(['R', 'G', 'B', 'A'], [0, 0, 0, 255, 0, 0, 0, 255]);
    expect(nonZeroBins(computeHistogram(img, 'R'))).toEqual({ 0: 2 });
    expect(nonZeroBins(computeHistogram(img, 'G'))).toEqual({ 0: 2 });
    expect(nonZeroBins(computeHistogram(img, 'B'))).toEqual({ 0: 2 });
    expect(nonZeroBins(computeHistogram(img, 'A'))).toEqual({ 255: 2 });
    expect(nonZeroBins(computeHistogram(img, 'lightness'))).toEqual({ 0: 2 });
  });

  it('counts pure white into bin 255 across channels and lightness', () => {
    const img = makeImage(['R', 'G', 'B', 'A'], [255, 255, 255, 255]);
    expect(nonZeroBins(computeHistogram(img, 'R'))).toEqual({ 255: 1 });
    expect(nonZeroBins(computeHistogram(img, 'lightness'))).toEqual({ 255: 1 });
  });

  it('per-channel histograms see only their own component', () => {
    // Three pixels with isolated channels: pure R, pure G, pure B.
    const img = makeImage(
      ['R', 'G', 'B', 'A'],
      [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255],
    );
    expect(nonZeroBins(computeHistogram(img, 'R'))).toEqual({ 0: 2, 255: 1 });
    expect(nonZeroBins(computeHistogram(img, 'G'))).toEqual({ 0: 2, 255: 1 });
    expect(nonZeroBins(computeHistogram(img, 'B'))).toEqual({ 0: 2, 255: 1 });
  });

  it('HSL lightness puts pure red and pure green at 127 (=128 by formula)', () => {
    // (max + min) / 2 with integer shift: (255 + 0) >> 1 = 127.
    const img = makeImage(['R', 'G', 'B', 'A'], [255, 0, 0, 255, 0, 255, 0, 255]);
    expect(nonZeroBins(computeHistogram(img, 'lightness'))).toEqual({ 127: 2 });
  });

  it('HSL lightness puts mid-gray (128,128,128) at 128', () => {
    const img = makeImage(['R', 'G', 'B', 'A'], [128, 128, 128, 255]);
    expect(nonZeroBins(computeHistogram(img, 'lightness'))).toEqual({ 128: 1 });
  });

  it("treats 'Gray' source as the R byte", () => {
    const img = makeImage(['Gray'], [50, 50, 50, 255, 200, 200, 200, 255]);
    expect(nonZeroBins(computeHistogram(img, 'Gray'))).toEqual({ 50: 1, 200: 1 });
  });

  it('Alpha histogram counts the fourth byte', () => {
    const img = makeImage(['R', 'G', 'B', 'A'], [0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 255]);
    expect(nonZeroBins(computeHistogram(img, 'A'))).toEqual({ 0: 1, 128: 1, 255: 1 });
  });
});
