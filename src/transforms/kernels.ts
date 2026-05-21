import { IDENTITY_KERNEL, type Kernel3x3 } from './convolution';

export type KernelPreset = {
  /** Stable identifier used by the dialog dropdown's selection state. */
  id: string;
  /** Display label shown in the dropdown. */
  label: string;
  /** Short description for the dropdown's tooltip. */
  description: string;
  kernel: Kernel3x3;
};

/**
 * Pre-built 3×3 kernels offered in the convolution dialog dropdown.
 *
 * The six required by the task spec (identity, sharpen, gaussian, box blur,
 * Prewitt X, Prewitt Y) are present; Laplacian and emboss are added as bonus
 * presets because they're easy to demo and educationally useful.
 */
export const KERNEL_PRESETS: readonly KernelPreset[] = [
  {
    id: 'identity',
    label: 'Тождественное',
    description: 'Без изменений — единица в центре, нули вокруг.',
    kernel: IDENTITY_KERNEL,
  },
  {
    id: 'sharpen',
    label: 'Повышение резкости',
    description: 'Усиливает разницу между пикселем и его соседями.',
    kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0] as const,
  },
  {
    id: 'gaussian',
    label: 'Гаусс 3×3',
    description: 'Размытие с весами по Гауссу. Естественнее, чем box blur.',
    kernel: [
      1 / 16, 2 / 16, 1 / 16,
      2 / 16, 4 / 16, 2 / 16,
      1 / 16, 2 / 16, 1 / 16,
    ] as const,
  },
  {
    id: 'box',
    label: 'Среднее (box blur)',
    description: 'Среднее значение 9 соседей. Жёстче Гаусса, появляется характерный квадратный артефакт.',
    kernel: [
      1 / 9, 1 / 9, 1 / 9,
      1 / 9, 1 / 9, 1 / 9,
      1 / 9, 1 / 9, 1 / 9,
    ] as const,
  },
  {
    id: 'prewittX',
    label: 'Прюитт X (выделение вертикальных границ)',
    description: 'Градиент яркости по горизонтали. Сумма = 0, поэтому однородные области уйдут в чёрный.',
    kernel: [-1, 0, 1, -1, 0, 1, -1, 0, 1] as const,
  },
  {
    id: 'prewittY',
    label: 'Прюитт Y (выделение горизонтальных границ)',
    description: 'Градиент яркости по вертикали. Сумма = 0.',
    kernel: [-1, -1, -1, 0, 0, 0, 1, 1, 1] as const,
  },
  {
    id: 'laplacian',
    label: 'Лаплас (изотропный детектор границ)',
    description: 'Реагирует на резкие перепады в любом направлении.',
    kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0] as const,
  },
  {
    id: 'emboss',
    label: 'Тиснение',
    description: 'Псевдо-3D эффект: освещение «сверху-слева».',
    kernel: [-2, -1, 0, -1, 1, 1, 0, 1, 2] as const,
  },
];

/**
 * Find the preset whose kernel matches the given coefficients exactly (within
 * a small epsilon for Gaussian-style fractional values). Returns undefined for
 * user-edited kernels, which the dialog displays as "Произвольное".
 */
export function findPresetByKernel(k: Kernel3x3, eps = 1e-6): KernelPreset | undefined {
  return KERNEL_PRESETS.find((p) => kernelsEqual(p.kernel, k, eps));
}

function kernelsEqual(a: Kernel3x3, b: Kernel3x3, eps: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (Math.abs(a[i]! - b[i]!) > eps) return false;
  }
  return true;
}
