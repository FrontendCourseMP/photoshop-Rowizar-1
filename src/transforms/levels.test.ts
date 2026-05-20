import { describe, expect, it } from 'vitest';
import type { Channel, RasterImage } from '../formats/types';
import {
  IDENTITY_LEVELS_BAG,
  IDENTITY_LEVELS_PARAMS,
  applyLevels,
  buildLUT,
  composeLUTs,
} from './levels';

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

describe('buildLUT', () => {
  it('returns the 0..255 ramp for identity params', () => {
    const lut = buildLUT(IDENTITY_LEVELS_PARAMS);
    for (let i = 0; i < 256; i++) expect(lut[i]).toBe(i);
  });

  it('clips inputs below black to 0 and above white to 255', () => {
    const lut = buildLUT({ black: 50, white: 200, gamma: 1 });
    expect(lut[0]).toBe(0);
    expect(lut[49]).toBe(0);
    expect(lut[50]).toBe(0);
    expect(lut[200]).toBe(255);
    expect(lut[255]).toBe(255);
  });

  it('stretches linearly between black and white when gamma=1', () => {
    const lut = buildLUT({ black: 50, white: 200, gamma: 1 });
    // midpoint of [50, 200] is 125 → output ~127
    expect(lut[125]).toBeGreaterThanOrEqual(126);
    expect(lut[125]).toBeLessThanOrEqual(128);
  });

  it('lifts midtones when gamma > 1', () => {
    const lut = buildLUT({ black: 0, white: 255, gamma: 2 });
    // mid input 128 → t = 0.5 → t^(1/2) = √0.5 ≈ 0.707 → out ≈ 180
    expect(lut[128]).toBeGreaterThan(170);
    expect(lut[128]).toBeLessThan(190);
    // endpoints unchanged
    expect(lut[0]).toBe(0);
    expect(lut[255]).toBe(255);
  });

  it('darkens midtones when gamma < 1', () => {
    const lut = buildLUT({ black: 0, white: 255, gamma: 0.5 });
    // mid input 128 → t = 0.5 → t^2 = 0.25 → out ≈ 64
    expect(lut[128]).toBeGreaterThan(60);
    expect(lut[128]).toBeLessThan(70);
  });

  it('guards against degenerate white <= black', () => {
    expect(() => buildLUT({ black: 100, white: 100, gamma: 1 })).not.toThrow();
  });
});

describe('composeLUTs', () => {
  it('produces out[i] = second[first[i]]', () => {
    const first = new Uint8Array(256);
    const second = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      first[i] = 255 - i;
      second[i] = Math.min(255, i + 10);
    }
    const composed = composeLUTs(first, second);
    expect(composed[0]).toBe(255); // first[0]=255, second[255]=255
    expect(composed[100]).toBe(second[first[100]!]!); // sanity
  });
});

describe('applyLevels', () => {
  it('returns the source image as-is for an identity bag', () => {
    const img = makeImage(['R', 'G', 'B', 'A'], [10, 20, 30, 200]);
    expect(applyLevels(img, IDENTITY_LEVELS_BAG)).toBe(img);
  });

  it('clips RGB pixels via master, leaves alpha untouched', () => {
    const img = makeImage(['R', 'G', 'B', 'A'], [10, 50, 200, 128]);
    const out = applyLevels(img, {
      ...IDENTITY_LEVELS_BAG,
      master: { black: 50, white: 200, gamma: 1 },
    });
    // R=10 clips to 0, G=50 clips to 0, B=200 hits white -> 255, alpha unchanged
    expect([...out.pixels]).toEqual([0, 0, 255, 128]);
  });

  it('composes master with per-channel R (master first, then R)', () => {
    // master gamma 2 lifts midtones; then R clamps black=100 white=200.
    // input R=128 -> master pow(0.502, 0.5)*255 ≈ 180 -> R lut(180) =
    //   ((180-100)/100)*255 = 204.
    const img = makeImage(['R', 'G', 'B', 'A'], [128, 0, 0, 255]);
    const out = applyLevels(img, {
      ...IDENTITY_LEVELS_BAG,
      master: { black: 0, white: 255, gamma: 2 },
      R: { black: 100, white: 200, gamma: 1 },
    });
    expect(out.pixels[0]).toBeGreaterThan(200);
    expect(out.pixels[0]).toBeLessThan(210);
    // G and B got master only (no per-channel adjustment, so identity in R/G/B fields):
    // input 0 -> master lut(0) = 0
    expect(out.pixels[1]).toBe(0);
    expect(out.pixels[2]).toBe(0);
    // alpha unchanged
    expect(out.pixels[3]).toBe(255);
  });

  it('grayscale images route through Gray LUT, not master', () => {
    const img = makeImage(['Gray'], [50, 50, 50, 255, 200, 200, 200, 255]);
    const out = applyLevels(img, {
      ...IDENTITY_LEVELS_BAG,
      // Master gamma 2 would normally lift midtones a lot — but for gray we
      // must IGNORE master and only apply Gray (here identity).
      master: { black: 0, white: 255, gamma: 2 },
      Gray: IDENTITY_LEVELS_PARAMS,
    });
    expect([...out.pixels]).toEqual([50, 50, 50, 255, 200, 200, 200, 255]);
  });

  it('grayscale: Gray LUT is replicated into R, G, B output bytes', () => {
    const img = makeImage(['Gray', 'A'], [128, 128, 128, 100]);
    const out = applyLevels(img, {
      ...IDENTITY_LEVELS_BAG,
      Gray: { black: 0, white: 255, gamma: 2 }, // lift midtones
      A: { black: 100, white: 255, gamma: 1 },   // alpha 100 -> 0
    });
    // Same gray value should appear in R, G, B
    expect(out.pixels[0]).toBe(out.pixels[1]);
    expect(out.pixels[1]).toBe(out.pixels[2]);
    expect(out.pixels[0]).toBeGreaterThan(170);
    // alpha clipped to 0
    expect(out.pixels[3]).toBe(0);
  });
});
