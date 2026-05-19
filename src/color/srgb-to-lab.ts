/**
 * sRGB (8-bit, 0..255) → CIELAB conversion via XYZ with D65 reference white.
 *
 * Pipeline:
 *   1. Normalise to [0..1] and clamp.
 *   2. sRGB gamma decompanding: linear = c/12.92 below 0.04045,
 *      ((c + 0.055) / 1.055)^2.4 above. This undoes the perceptual encoding
 *      stored in the file.
 *   3. Linear-RGB → XYZ via the standard D65 matrix (Bruce Lindbloom).
 *   4. XYZ → L*a*b* using the piecewise f(t) and Xn/Yn/Zn = D65.
 *
 * Output ranges: L ∈ [0, 100], a/b roughly in [-128, +127] for in-gamut sRGB.
 */

export type Lab = { L: number; a: number; b: number };

// D65 reference white, scaled so Yn = 1.
const Xn = 0.95047;
const Yn = 1.0;
const Zn = 1.08883;

// f(t) breakpoint constants — δ = 6/29, used in the CIELAB definition.
const DELTA_CUBED = (6 / 29) ** 3; // ≈ 0.008856
const LINEAR_SLOPE = (1 / 3) * (29 / 6) ** 2; // ≈ 7.787

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function srgbToLinear(c01: number): number {
  if (c01 <= 0.04045) return c01 / 12.92;
  return Math.pow((c01 + 0.055) / 1.055, 2.4);
}

function labF(t: number): number {
  if (t > DELTA_CUBED) return Math.cbrt(t);
  return LINEAR_SLOPE * t + 4 / 29;
}

export function srgbToLab(r: number, g: number, b: number): Lab {
  const R = srgbToLinear(clamp01(r / 255));
  const G = srgbToLinear(clamp01(g / 255));
  const B = srgbToLinear(clamp01(b / 255));

  const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B;
  const Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B;
  const Z = 0.0193339 * R + 0.1191920 * G + 0.9503041 * B;

  const fx = labF(X / Xn);
  const fy = labF(Y / Yn);
  const fz = labF(Z / Zn);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}
