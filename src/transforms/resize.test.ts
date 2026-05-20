import { describe, expect, it } from 'vitest';
import type { Channel, RasterImage } from '../formats/types';
import { resizeImage } from './resize';

function makeImage(
  width: number,
  height: number,
  pixels: number[],
  channels: Channel[] = ['R', 'G', 'B', 'A'],
): RasterImage {
  const buf = new Uint8ClampedArray(pixels.length);
  buf.set(pixels);
  return {
    width,
    height,
    pixels: buf,
    meta: { format: 'png', bitDepth: 8, channels },
  };
}

describe('resizeImage', () => {
  it('returns the source as-is when dimensions match', () => {
    const img = makeImage(2, 2, [
      0, 0, 0, 255, 255, 255, 255, 255,
      255, 0, 0, 255, 0, 255, 0, 255,
    ]);
    expect(resizeImage(img, 2, 2, 'bilinear')).toBe(img);
    expect(resizeImage(img, 2, 2, 'nearest')).toBe(img);
  });

  it('throws on non-positive or non-integer dimensions', () => {
    const img = makeImage(2, 2, new Array(16).fill(0));
    expect(() => resizeImage(img, 0, 2, 'nearest')).toThrow();
    expect(() => resizeImage(img, 2, -1, 'bilinear')).toThrow();
    expect(() => resizeImage(img, 1.5, 2, 'nearest')).toThrow();
  });

  describe('nearest neighbour', () => {
    it('2× upscales a 2×1 image by duplicating pixels into a 4×2 image', () => {
      const img = makeImage(2, 1, [0, 0, 0, 255, 255, 255, 255, 255]);
      const out = resizeImage(img, 4, 2, 'nearest');
      expect(out.width).toBe(4);
      expect(out.height).toBe(2);
      // Each row: black, black, white, white (R values at o, o+4, o+8, o+12)
      for (const rowOff of [0, 16]) {
        expect(out.pixels[rowOff]).toBe(0);
        expect(out.pixels[rowOff + 4]).toBe(0);
        expect(out.pixels[rowOff + 8]).toBe(255);
        expect(out.pixels[rowOff + 12]).toBe(255);
      }
    });

    it('does not blend — output pixels exactly equal a source pixel', () => {
      const img = makeImage(2, 2, [
        10, 20, 30, 255, 100, 110, 120, 255,
        200, 210, 220, 255, 50, 60, 70, 255,
      ]);
      const out = resizeImage(img, 4, 4, 'nearest');
      // Every output pixel's RGB must match some source pixel's RGB exactly.
      const allowed = new Set(['10,20,30', '100,110,120', '200,210,220', '50,60,70']);
      for (let i = 0; i < out.pixels.length; i += 4) {
        const key = `${out.pixels[i]},${out.pixels[i + 1]},${out.pixels[i + 2]}`;
        expect(allowed.has(key)).toBe(true);
      }
    });
  });

  describe('bilinear', () => {
    it('upscales 2×1 → 3×1, midpoint pixel blends towards 50/50', () => {
      const img = makeImage(2, 1, [0, 0, 0, 255, 255, 255, 255, 255]);
      const out = resizeImage(img, 3, 1, 'bilinear');
      // Output: [near-black, mid-gray, near-white]
      expect(out.pixels[0]).toBeLessThan(40);
      expect(out.pixels[8]).toBeGreaterThan(215);
      const mid = out.pixels[4]!;
      expect(mid).toBeGreaterThanOrEqual(120);
      expect(mid).toBeLessThanOrEqual(135);
    });

    it('preserves solid colour through arbitrary scale', () => {
      const img = makeImage(2, 2, [
        100, 100, 100, 200, 100, 100, 100, 200,
        100, 100, 100, 200, 100, 100, 100, 200,
      ]);
      const out = resizeImage(img, 5, 5, 'bilinear');
      for (let i = 0; i < out.pixels.length; i += 4) {
        expect(Math.abs(out.pixels[i]! - 100)).toBeLessThanOrEqual(1);
        expect(Math.abs(out.pixels[i + 3]! - 200)).toBeLessThanOrEqual(1);
      }
    });

    it('downscales 4×1 → 2×1', () => {
      // Source pixels: R values 0, 80, 160, 240.
      const img = makeImage(4, 1, [
        0, 0, 0, 255, 80, 0, 0, 255, 160, 0, 0, 255, 240, 0, 0, 255,
      ]);
      const out = resizeImage(img, 2, 1, 'bilinear');
      expect(out.width).toBe(2);
      expect(out.height).toBe(1);
      // dst 0 centre maps to src 0.5, dst 1 centre maps to src 2.5 — both
      // land between source pixels and produce ~midpoint blends.
      expect(out.pixels[0]).toBeGreaterThan(20);
      expect(out.pixels[0]).toBeLessThan(70);
      expect(out.pixels[4]).toBeGreaterThan(180);
      expect(out.pixels[4]).toBeLessThan(230);
    });

    it('alpha channel is blended just like RGB', () => {
      // 2×1: opaque black, transparent white. Midpoint of 3×1 should have
      // alpha around 127 and a colour blend.
      const img = makeImage(2, 1, [0, 0, 0, 255, 255, 255, 255, 0]);
      const out = resizeImage(img, 3, 1, 'bilinear');
      const midA = out.pixels[7]!;
      expect(midA).toBeGreaterThanOrEqual(120);
      expect(midA).toBeLessThanOrEqual(135);
    });
  });

  it('preserves meta (format, channels, bitDepth)', () => {
    const img = makeImage(2, 2, new Array(16).fill(128), ['Gray']);
    const out = resizeImage(img, 4, 4, 'bilinear');
    expect(out.meta).toEqual(img.meta);
  });
});
