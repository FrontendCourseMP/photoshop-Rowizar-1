import type { RasterImage } from '../formats/types';

/**
 * Interpolation kernel for resizing. The union is left open so adding bicubic
 * or lanczos later is one new case in resizeImage rather than a refactor.
 */
export type InterpolationMethod = 'nearest' | 'bilinear';

/**
 * Resize an image to (newWidth × newHeight) using the given interpolation
 * method. Hand-rolled per the lab requirement — we do not delegate to
 * ctx.drawImage. Identity short-circuits to the input image (no copy).
 *
 * Both methods use half-pixel-aligned inverse mapping so the target's pixel
 * centres land between the same fractional source coordinates regardless of
 * which axis is being scaled — this avoids the half-pixel shift you get from
 * naive integer scaling.
 *
 *   Nearest: pick the source pixel closest to the inverse-mapped target
 *            coordinate. No averaging. Crisp edges, blocky on upscale.
 *
 *   Bilinear: take the four source pixels around the fractional inverse
 *             coordinate and combine them with distance-weighted blending
 *             (the four weights sum to 1). Smooth gradient transitions.
 *             For >2× downscaling this aliases — that's textbook bilinear,
 *             not a bug; we don't claim to box-filter.
 *
 * Edge handling: source coordinates that fall outside the image are clamped
 * to the nearest valid pixel. Weights are computed against the unclamped
 * fractional position so they stay in [0, 1].
 */
export function resizeImage(
  image: RasterImage,
  newWidth: number,
  newHeight: number,
  method: InterpolationMethod,
): RasterImage {
  if (!Number.isInteger(newWidth) || !Number.isInteger(newHeight)) {
    throw new Error('resizeImage: dimensions must be integers');
  }
  if (newWidth <= 0 || newHeight <= 0) {
    throw new Error('resizeImage: dimensions must be positive');
  }
  if (newWidth === image.width && newHeight === image.height) return image;

  const srcW = image.width;
  const srcH = image.height;
  const src = image.pixels;
  const out = new Uint8ClampedArray(newWidth * newHeight * 4);
  const sx = srcW / newWidth;
  const sy = srcH / newHeight;

  if (method === 'nearest') {
    for (let y = 0; y < newHeight; y++) {
      const fy = (y + 0.5) * sy - 0.5;
      const srcY = clamp(Math.round(fy), 0, srcH - 1);
      const rowOff = srcY * srcW;
      for (let x = 0; x < newWidth; x++) {
        const fx = (x + 0.5) * sx - 0.5;
        const srcX = clamp(Math.round(fx), 0, srcW - 1);
        const so = (rowOff + srcX) * 4;
        const o = (y * newWidth + x) * 4;
        out[o] = src[so]!;
        out[o + 1] = src[so + 1]!;
        out[o + 2] = src[so + 2]!;
        out[o + 3] = src[so + 3]!;
      }
    }
  } else {
    for (let y = 0; y < newHeight; y++) {
      const fy = (y + 0.5) * sy - 0.5;
      const y0Raw = Math.floor(fy);
      const wy = fy - y0Raw;
      const wy1 = 1 - wy;
      const y0 = clamp(y0Raw, 0, srcH - 1);
      const y1 = clamp(y0Raw + 1, 0, srcH - 1);
      const row0 = y0 * srcW;
      const row1 = y1 * srcW;
      for (let x = 0; x < newWidth; x++) {
        const fx = (x + 0.5) * sx - 0.5;
        const x0Raw = Math.floor(fx);
        const wx = fx - x0Raw;
        const wx1 = 1 - wx;
        const x0 = clamp(x0Raw, 0, srcW - 1);
        const x1 = clamp(x0Raw + 1, 0, srcW - 1);

        const o00 = (row0 + x0) * 4;
        const o10 = (row0 + x1) * 4;
        const o01 = (row1 + x0) * 4;
        const o11 = (row1 + x1) * 4;

        const w00 = wx1 * wy1;
        const w10 = wx * wy1;
        const w01 = wx1 * wy;
        const w11 = wx * wy;

        const o = (y * newWidth + x) * 4;
        out[o] =
          src[o00]! * w00 + src[o10]! * w10 + src[o01]! * w01 + src[o11]! * w11;
        out[o + 1] =
          src[o00 + 1]! * w00 + src[o10 + 1]! * w10 + src[o01 + 1]! * w01 + src[o11 + 1]! * w11;
        out[o + 2] =
          src[o00 + 2]! * w00 + src[o10 + 2]! * w10 + src[o01 + 2]! * w01 + src[o11 + 2]! * w11;
        out[o + 3] =
          src[o00 + 3]! * w00 + src[o10 + 3]! * w10 + src[o01 + 3]! * w01 + src[o11 + 3]! * w11;
      }
    }
  }

  return {
    width: newWidth,
    height: newHeight,
    pixels: out,
    meta: image.meta,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
