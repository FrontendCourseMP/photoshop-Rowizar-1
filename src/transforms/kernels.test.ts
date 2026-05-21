import { describe, expect, it } from 'vitest';
import { KERNEL_PRESETS, findPresetByKernel } from './kernels';
import { IDENTITY_KERNEL } from './convolution';

describe('KERNEL_PRESETS', () => {
  it('includes all six task-required presets plus the two bonus ones', () => {
    const ids = KERNEL_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      'identity',
      'sharpen',
      'gaussian',
      'box',
      'prewittX',
      'prewittY',
      'laplacian',
      'emboss',
    ]);
  });

  it('Gaussian and box-blur kernels sum to 1 (intensity-preserving blur)', () => {
    const gaussian = KERNEL_PRESETS.find((p) => p.id === 'gaussian')!.kernel;
    const box = KERNEL_PRESETS.find((p) => p.id === 'box')!.kernel;
    const sum = (k: readonly number[]) => k.reduce((s, x) => s + x, 0);
    expect(sum(gaussian)).toBeCloseTo(1, 5);
    expect(sum(box)).toBeCloseTo(1, 5);
  });

  it('edge-detection kernels (Prewitt X/Y, Laplacian) sum to 0', () => {
    const sum = (k: readonly number[]) => k.reduce((s, x) => s + x, 0);
    expect(sum(KERNEL_PRESETS.find((p) => p.id === 'prewittX')!.kernel)).toBe(0);
    expect(sum(KERNEL_PRESETS.find((p) => p.id === 'prewittY')!.kernel)).toBe(0);
    expect(sum(KERNEL_PRESETS.find((p) => p.id === 'laplacian')!.kernel)).toBe(0);
  });
});

describe('findPresetByKernel', () => {
  it('matches the identity preset by content', () => {
    const preset = findPresetByKernel(IDENTITY_KERNEL);
    expect(preset?.id).toBe('identity');
  });

  it('returns undefined for an unknown kernel', () => {
    const custom = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] as const;
    expect(findPresetByKernel(custom)).toBeUndefined();
  });
});
