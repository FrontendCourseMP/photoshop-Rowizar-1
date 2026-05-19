import type { RasterImage } from '../formats/types';
import type { ChannelMask } from './types';

/**
 * Produce a derived RasterImage with the channel mask applied. Source pixels
 * are never mutated — callers can keep their sourceImage reference intact
 * (assignment requirement: «никогда не перезаписывайте оригинальный массив»).
 *
 * Rules:
 *  - R/G/B/Gray off → that component is zeroed in the output.
 *  - A off          → alpha forced to 255 (the image is rendered as opaque).
 *  - Only A on (RGB/Gray off, A on) → special "alpha-as-mask" view: each
 *    pixel becomes R=G=B=alpha with alpha=255. The user sees the
 *    transparency mask as a grayscale image, per the assignment.
 *
 * Optimisation: when the mask leaves every channel of the image enabled,
 * the source RasterImage is returned as-is (no pixel copy).
 */
export function applyChannelMask(image: RasterImage, mask: ChannelMask): RasterImage {
  const channels = image.meta.channels;
  if (channels.every((c) => mask[c])) {
    return image;
  }

  const pixelCount = image.width * image.height;
  const src = image.pixels;
  const out = new Uint8ClampedArray(pixelCount * 4);

  const hasA = channels.includes('A');
  const onCount = channels.reduce((n, c) => n + (mask[c] ? 1 : 0), 0);
  const isAlphaMaskView = hasA && mask.A && onCount === 1;

  if (isAlphaMaskView) {
    for (let i = 0; i < pixelCount; i++) {
      const o = i * 4;
      const a = src[o + 3]!;
      out[o] = a;
      out[o + 1] = a;
      out[o + 2] = a;
      out[o + 3] = 255;
    }
  } else {
    // Pre-compute per-component overrides so the inner loop is branch-free
    // on the mask flags.
    const zeroR = channels.includes('R') && !mask.R;
    const zeroG = channels.includes('G') && !mask.G;
    const zeroB = channels.includes('B') && !mask.B;
    const zeroGrayAll = channels.includes('Gray') && !mask.Gray;
    const forceOpaque = hasA && !mask.A;

    for (let i = 0; i < pixelCount; i++) {
      const o = i * 4;
      let r = src[o]!;
      let g = src[o + 1]!;
      let b = src[o + 2]!;
      let a = src[o + 3]!;

      if (zeroGrayAll) {
        r = 0;
        g = 0;
        b = 0;
      }
      if (zeroR) r = 0;
      if (zeroG) g = 0;
      if (zeroB) b = 0;
      if (forceOpaque) a = 255;

      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = a;
    }
  }

  return {
    width: image.width,
    height: image.height,
    pixels: out,
    meta: image.meta,
  };
}
