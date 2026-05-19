import type { Lab } from '@/color/srgb-to-lab';

/**
 * Interactive tool currently engaged. 'none' is the idle/default state where
 * the canvas accepts no clicks beyond drag-and-drop. Future labs add more.
 */
export type Tool = 'none' | 'eyedropper';

/**
 * Snapshot of a single pixel read by the eyedropper. Coordinates are in
 * source image pixel space (not CSS pixels). RGBA values come directly from
 * sourceImage — never from displayImage — so the reading does not depend on
 * the current channel mask.
 */
export type PickedPixel = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  lab: Lab;
};
