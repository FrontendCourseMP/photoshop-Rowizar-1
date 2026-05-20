import type { RasterImage } from '../formats/types';

/**
 * Per-knob Levels parameters. All values are in the 8-bit input space:
 *   black ∈ [0, 254]  — input value that maps to output 0.
 *   white ∈ [black+1, 255] — input value that maps to output 255.
 *   gamma ∈ [0.1, 9.9] — midtone curve exponent. 1.0 is linear.
 *     gamma > 1 lifts midtones (brighter), gamma < 1 darkens them.
 */
export type LevelsParams = {
  black: number;
  white: number;
  gamma: number;
};

/**
 * Per-channel Levels state. Master applies to RGB only and is composed with
 * each per-channel LUT (R/G/B). Alpha and Gray are standalone — master does
 * not touch them. ApplyLevels picks the relevant subset based on the image's
 * meta.channels at execution time.
 */
export type LevelsBag = {
  master: LevelsParams;
  R: LevelsParams;
  G: LevelsParams;
  B: LevelsParams;
  A: LevelsParams;
  Gray: LevelsParams;
};

export const IDENTITY_LEVELS_PARAMS: LevelsParams = {
  black: 0,
  white: 255,
  gamma: 1,
};

export const IDENTITY_LEVELS_BAG: LevelsBag = {
  master: IDENTITY_LEVELS_PARAMS,
  R: IDENTITY_LEVELS_PARAMS,
  G: IDENTITY_LEVELS_PARAMS,
  B: IDENTITY_LEVELS_PARAMS,
  A: IDENTITY_LEVELS_PARAMS,
  Gray: IDENTITY_LEVELS_PARAMS,
};

export function isIdentityParams(p: LevelsParams): boolean {
  return p.black === 0 && p.white === 255 && p.gamma === 1;
}

export function isIdentityBag(bag: LevelsBag): boolean {
  return (
    isIdentityParams(bag.master) &&
    isIdentityParams(bag.R) &&
    isIdentityParams(bag.G) &&
    isIdentityParams(bag.B) &&
    isIdentityParams(bag.A) &&
    isIdentityParams(bag.Gray)
  );
}

/**
 * Build a 256-entry lookup table for the given Levels parameters.
 *
 *   t  = clamp((i - black) / (white - black), 0, 1)
 *   t' = t ^ (1 / gamma)
 *   out = round(t' * 255), clamped to [0, 255]
 *
 * Identity is short-circuited (returns the 0..255 ramp) so the common case
 * costs nothing extra.
 *
 * The denominator is guarded with Math.max(1, ...) so a degenerate
 * black ≥ white never divides by zero — the UI prevents it, but defensive.
 */
export function buildLUT(params: LevelsParams): Uint8Array {
  const lut = new Uint8Array(256);
  if (isIdentityParams(params)) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const { black, white, gamma } = params;
  const denom = Math.max(1, white - black);
  const invGamma = 1 / gamma;

  for (let i = 0; i < 256; i++) {
    let t = (i - black) / denom;
    if (t <= 0) {
      lut[i] = 0;
      continue;
    }
    if (t >= 1) {
      lut[i] = 255;
      continue;
    }
    const corrected = Math.pow(t, invGamma);
    lut[i] = Math.max(0, Math.min(255, Math.round(corrected * 255)));
  }
  return lut;
}

/**
 * Compose two LUTs into one: out[i] = second[first[i]]. Used to fold master
 * into per-channel R/G/B in a single pass over the image, avoiding the
 * round-trip-through-canvas precision loss of two sequential putImageData
 * applications.
 */
export function composeLUTs(first: Uint8Array, second: Uint8Array): Uint8Array {
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i++) out[i] = second[first[i]!]!;
  return out;
}

/**
 * Apply per-channel Levels to a RasterImage.
 *
 * For RGB(A) images: master is pre-composed with each of R/G/B; alpha gets
 * its own LUT (master never touches alpha — it isn't a colour channel).
 *
 * For Gray(A) images: Gray's LUT is applied to the R/G/B bytes (they all
 * carry the gray value already), alpha gets its own LUT. Master is skipped
 * because it's an RGB-side concept; the dialog won't surface master for
 * grayscale images either.
 *
 * Identity bag short-circuits to the input image (no copy).
 */
export function applyLevels(image: RasterImage, bag: LevelsBag): RasterImage {
  if (isIdentityBag(bag)) return image;

  const src = image.pixels;
  const pixelCount = image.width * image.height;
  const out = new Uint8ClampedArray(pixelCount * 4);
  const isGray = image.meta.channels.includes('Gray');

  if (isGray) {
    const grayLut = buildLUT(bag.Gray);
    const aLut = buildLUT(bag.A);
    for (let i = 0; i < pixelCount; i++) {
      const o = i * 4;
      const g = grayLut[src[o]!]!;
      out[o] = g;
      out[o + 1] = g;
      out[o + 2] = g;
      out[o + 3] = aLut[src[o + 3]!]!;
    }
  } else {
    const masterLut = buildLUT(bag.master);
    const rLut = composeLUTs(masterLut, buildLUT(bag.R));
    const gLut = composeLUTs(masterLut, buildLUT(bag.G));
    const bLut = composeLUTs(masterLut, buildLUT(bag.B));
    const aLut = buildLUT(bag.A);
    for (let i = 0; i < pixelCount; i++) {
      const o = i * 4;
      out[o] = rLut[src[o]!]!;
      out[o + 1] = gLut[src[o + 1]!]!;
      out[o + 2] = bLut[src[o + 2]!]!;
      out[o + 3] = aLut[src[o + 3]!]!;
    }
  }

  return {
    width: image.width,
    height: image.height,
    pixels: out,
    meta: image.meta,
  };
}
