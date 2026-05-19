import { describe, expect, it } from 'vitest';
import { srgbToLab } from './srgb-to-lab';

/**
 * Reference values from the standard sRGB D65 → CIELAB conversion
 * (Bruce Lindbloom calculator, Adobe ICC). Tolerances are ~0.05 per
 * component (toBeCloseTo with 1 decimal digit ≈ |diff| < 0.05).
 */
function expectLab(
  got: { L: number; a: number; b: number },
  [L, a, b]: [number, number, number],
  digits = 1,
): void {
  expect(got.L).toBeCloseTo(L, digits);
  expect(got.a).toBeCloseTo(a, digits);
  expect(got.b).toBeCloseTo(b, digits);
}

describe('srgbToLab', () => {
  it('maps sRGB black (0,0,0) to (0, 0, 0)', () => {
    expectLab(srgbToLab(0, 0, 0), [0, 0, 0]);
  });

  it('maps sRGB white (255,255,255) to L=100, a=b≈0', () => {
    expectLab(srgbToLab(255, 255, 255), [100, 0, 0]);
  });

  it('maps pure red (255,0,0)', () => {
    expectLab(srgbToLab(255, 0, 0), [53.241, 80.092, 67.203]);
  });

  it('maps pure green (0,255,0)', () => {
    expectLab(srgbToLab(0, 255, 0), [87.735, -86.183, 83.179]);
  });

  it('maps pure blue (0,0,255)', () => {
    expectLab(srgbToLab(0, 0, 255), [32.297, 79.188, -107.86]);
  });

  it('maps mid gray (128,128,128) to a≈0, b≈0', () => {
    expectLab(srgbToLab(128, 128, 128), [53.585, 0, 0]);
  });

  it('keeps a=0, b=0 for any neutral gray', () => {
    for (const v of [10, 64, 192, 240]) {
      const lab = srgbToLab(v, v, v);
      // Floating-point drift from the f(t) piecewise + matrix multiply is well
      // under 1e-3 even at low values — tighter than what any UI cares about.
      expect(lab.a).toBeCloseTo(0, 3);
      expect(lab.b).toBeCloseTo(0, 3);
    }
  });

  it('clamps inputs outside 0..255', () => {
    const clamped = srgbToLab(-50, 999, 128);
    const expected = srgbToLab(0, 255, 128);
    expect(clamped.L).toBeCloseTo(expected.L, 5);
    expect(clamped.a).toBeCloseTo(expected.a, 5);
    expect(clamped.b).toBeCloseTo(expected.b, 5);
  });
});
