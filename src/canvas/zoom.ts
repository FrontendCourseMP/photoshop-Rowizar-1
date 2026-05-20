import type { RasterImage } from '../formats/types';

/**
 * View-zoom utilities. View zoom is a CSS-only concept — these functions
 * deal purely with numbers, never touch RasterImage pixels. The canvas
 * keeps its bitmap at native source size; the browser handles the visual
 * scaling via inline width/height styles.
 */

export const ZOOM_MIN = 12;
export const ZOOM_MAX = 300;
const ZOOM_CENTER = 100;
const FIT_MARGIN = 50;

const LN_MIN = Math.log(ZOOM_MIN);
const LN_CENTER = Math.log(ZOOM_CENTER);
const LN_MAX = Math.log(ZOOM_MAX);

export function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

/**
 * Compute the zoom percentage that fits the image inside the viewport with
 * at least FIT_MARGIN pixels on each side, then clamp to [ZOOM_MIN, ZOOM_MAX].
 */
export function computeFitZoom(
  image: RasterImage,
  viewportW: number,
  viewportH: number,
): number {
  const maxW = Math.max(1, viewportW - FIT_MARGIN * 2);
  const maxH = Math.max(1, viewportH - FIT_MARGIN * 2);
  const ratio = Math.min(maxW / image.width, maxH / image.height);
  return clampZoom(Math.round(ratio * 100));
}

/**
 * Piecewise-log mapping from slider position (0..100) to zoom percent so
 * that the slider centre is 100% and each half covers the same number of
 * doublings (12→100 = 8.3×, 100→300 = 3×). Linear felt cramped at the low
 * end.
 */
export function sliderToZoom(s: number): number {
  const t = Math.max(0, Math.min(100, s));
  if (t <= 50) {
    return Math.exp(LN_MIN + (t / 50) * (LN_CENTER - LN_MIN));
  }
  return Math.exp(LN_CENTER + ((t - 50) / 50) * (LN_MAX - LN_CENTER));
}

export function zoomToSlider(z: number): number {
  const c = clampZoom(z);
  if (c <= ZOOM_CENTER) {
    return (50 * (Math.log(c) - LN_MIN)) / (LN_CENTER - LN_MIN);
  }
  return 50 + (50 * (Math.log(c) - LN_CENTER)) / (LN_MAX - LN_CENTER);
}
