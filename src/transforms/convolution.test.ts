import { describe, expect, it } from 'vitest';
import type { Channel, RasterImage } from '../formats/types';
import {
  IDENTITY_KERNEL,
  applyConvolution,
  isIdentityKernel,
  type Kernel3x3,
} from './convolution';

function makeImage(
  width: number,
  height: number,
  pixels: number[],
  channels: Channel[] = ['R', 'G', 'B', 'A'],
): RasterImage {
  const buf = new Uint8ClampedArray(pixels);
  return {
    width,
    height,
    pixels: buf,
    meta: { format: 'png', bitDepth: 8, channels },
  };
}

const SHARPEN: Kernel3x3 = [0, -1, 0, -1, 5, -1, 0, -1, 0];
const BOX: Kernel3x3 = [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9];
const ALL_RGBA = new Set<Channel>(['R', 'G', 'B', 'A']);

describe('isIdentityKernel', () => {
  it('recognises the canonical identity', () => {
    expect(isIdentityKernel(IDENTITY_KERNEL)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isIdentityKernel(SHARPEN)).toBe(false);
    expect(isIdentityKernel([0, 0, 0, 0, 1.0001, 0, 0, 0, 0])).toBe(false);
  });
});

describe('applyConvolution', () => {
  it('short-circuits identity kernel to the source image', () => {
    const img = makeImage(2, 2, [10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255]);
    const out = applyConvolution(img, {
      kernel: IDENTITY_KERNEL,
      channels: ALL_RGBA,
      edgeMode: 'clamp',
    });
    expect(out).toBe(img);
  });

  it('keeps a uniform image uniform under sharpen (kernel sum = 1)', () => {
    const img = makeImage(3, 3, new Array(9).fill(0).flatMap(() => [100, 100, 100, 255]));
    const out = applyConvolution(img, {
      kernel: SHARPEN,
      channels: ALL_RGBA,
      edgeMode: 'clamp',
    });
    for (let i = 0; i < 9; i++) {
      expect(out.pixels[i * 4]).toBe(100);
      expect(out.pixels[i * 4 + 1]).toBe(100);
      expect(out.pixels[i * 4 + 2]).toBe(100);
    }
  });

  it('blurs a single-bright-pixel image to a 3×3 hot spot via box blur', () => {
    // 3×3 with centre 255 in R, rest 0. Box blur centre output = 255/9 ≈ 28.
    const pixels: number[] = [];
    for (let i = 0; i < 9; i++) {
      const isCenter = i === 4;
      pixels.push(isCenter ? 255 : 0, 0, 0, 255);
    }
    const img = makeImage(3, 3, pixels);
    const out = applyConvolution(img, {
      kernel: BOX,
      channels: new Set<Channel>(['R']),
      edgeMode: 'black',
    });
    // Centre should be ~28 (255 averaged with 8 zeros from neighbours + 8 zero
    // padding outside is irrelevant since centre sees only the original 3×3).
    expect(out.pixels[4 * 4]).toBeGreaterThan(25);
    expect(out.pixels[4 * 4]).toBeLessThan(32);
    // All corners see the centre once plus 8 zeros (5 from inside, hmm — at
    // corner (0,0) the 3×3 neighbourhood is centre at (0,0) which sees (1,1)
    // = the bright pixel. So output[0] = 255/9 ≈ 28.
    expect(out.pixels[0]).toBeGreaterThan(25);
    expect(out.pixels[0]).toBeLessThan(32);
  });

  it('clamp edge mode equals interior value for a uniform image', () => {
    // Uniform 100 image, any kernel — clamp padding sees the same value, so
    // a kernel summing to 1 yields 100 at corners (no edge artefact).
    const img = makeImage(3, 3, new Array(9).fill(0).flatMap(() => [100, 100, 100, 255]));
    const out = applyConvolution(img, {
      kernel: SHARPEN,
      channels: ALL_RGBA,
      edgeMode: 'clamp',
    });
    expect(out.pixels[0]).toBe(100); // corner
    expect(out.pixels[(2 * 3 + 2) * 4]).toBe(100); // opposite corner
  });

  it('black edge mode darkens corners under sharpen (5x100 - 4x0 = 500 → clamp 255)', () => {
    const img = makeImage(3, 3, new Array(9).fill(0).flatMap(() => [100, 100, 100, 255]));
    const out = applyConvolution(img, {
      kernel: SHARPEN,
      channels: new Set<Channel>(['R']),
      edgeMode: 'black',
    });
    // Top-left corner R: 5*100 - 100(right) - 100(down) - 0(left padding) - 0(up padding) = 300 → clamp 255.
    expect(out.pixels[0]).toBe(255);
  });

  it('white edge mode brightens corners under sharpen until clamp', () => {
    // Sharpen at corner with white padding: 5*100 - 255 - 100 - 255 - 100 = -210 → clamp 0.
    const img = makeImage(3, 3, new Array(9).fill(0).flatMap(() => [100, 100, 100, 255]));
    const out = applyConvolution(img, {
      kernel: SHARPEN,
      channels: new Set<Channel>(['R']),
      edgeMode: 'white',
    });
    expect(out.pixels[0]).toBe(0);
  });

  it('leaves channels outside the active set untouched', () => {
    const img = makeImage(3, 3, new Array(9).fill(0).flatMap(() => [10, 20, 30, 255]));
    const out = applyConvolution(img, {
      kernel: BOX,
      channels: new Set<Channel>(['R']),
      edgeMode: 'clamp',
    });
    // G/B/A bytes should be byte-for-byte copies of the source.
    for (let i = 0; i < 9; i++) {
      expect(out.pixels[i * 4 + 1]).toBe(20);
      expect(out.pixels[i * 4 + 2]).toBe(30);
      expect(out.pixels[i * 4 + 3]).toBe(255);
    }
  });

  it('treats Gray channel selection as enabling all RGB slots in grayscale image', () => {
    // Gray image stores value in R=G=B. Convolving 'Gray' should write all three.
    const img = makeImage(
      3,
      3,
      new Array(9).fill(0).flatMap(() => [50, 50, 50, 255]),
      ['Gray'],
    );
    const out = applyConvolution(img, {
      kernel: SHARPEN,
      channels: new Set<Channel>(['Gray']),
      edgeMode: 'clamp',
    });
    // Centre still 50 (uniform input, sharpen sum=1). R=G=B in output.
    for (let i = 0; i < 9; i++) {
      expect(out.pixels[i * 4]).toBe(50);
      expect(out.pixels[i * 4 + 1]).toBe(50);
      expect(out.pixels[i * 4 + 2]).toBe(50);
    }
  });

  it('does not mutate the source pixel buffer', () => {
    const img = makeImage(2, 2, [10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255]);
    const snapshot = [...img.pixels];
    applyConvolution(img, {
      kernel: BOX,
      channels: ALL_RGBA,
      edgeMode: 'clamp',
    });
    expect([...img.pixels]).toEqual(snapshot);
  });
});
