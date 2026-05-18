import type { RasterImage } from '../types';
import {
  GB7_FLAG_MASK,
  GB7_HEADER_SIZE,
  GB7_SIGNATURE,
  GB7_VERSION,
} from './spec';

export type EncodeGB7Options = {
  /**
   * Force a mask flag in the output. If undefined, falls back to
   * image.meta.hasMask; if that is also undefined, no mask is written.
   */
  includeMask?: boolean;
};

/**
 * Encode a RasterImage as a GB7 ArrayBuffer.
 *
 * When mask is disabled and the source has partially transparent pixels, we
 * composite onto white before quantising — otherwise saved-then-reloaded GB7
 * would visually diverge from what was on the canvas.
 */
export function encodeGB7(
  image: RasterImage,
  options: EncodeGB7Options = {},
): ArrayBuffer {
  const includeMask = options.includeMask ?? image.meta.hasMask ?? false;
  const { width, height, pixels } = image;
  const pixelCount = width * height;

  if (pixels.length !== pixelCount * 4) {
    throw new Error(
      `GB7 encode: pixel buffer size ${pixels.length} does not match ${width}×${height}×4`,
    );
  }

  const buffer = new ArrayBuffer(GB7_HEADER_SIZE + pixelCount);
  const view = new DataView(buffer);

  for (let i = 0; i < GB7_SIGNATURE.length; i++) {
    view.setUint8(i, GB7_SIGNATURE[i]!);
  }
  view.setUint8(4, GB7_VERSION);
  view.setUint8(5, includeMask ? GB7_FLAG_MASK : 0);
  view.setUint16(6, width, false);
  view.setUint16(8, height, false);
  view.setUint16(10, 0, false);

  const out = new Uint8Array(buffer, GB7_HEADER_SIZE, pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const r = pixels[o]!;
    const g = pixels[o + 1]!;
    const b = pixels[o + 2]!;
    const a = pixels[o + 3]!;

    let luma: number;
    if (includeMask || a === 255) {
      // Rec.601 luminance — keeps GB7 round-trip identity for pure grayscale.
      luma = (r * 299 + g * 587 + b * 114 + 500) / 1000;
    } else {
      // Composite onto white so dropped alpha does not darken the image.
      const af = a / 255;
      luma =
        (r * 299 + g * 587 + b * 114) * af + 255 * (1 - af) * 1000;
      luma = luma / 1000;
    }

    const g8 = Math.max(0, Math.min(255, Math.round(luma)));
    const g7 = g8 >> 1;

    let byte = g7 & 0x7f;
    if (includeMask) {
      byte |= a >= 128 ? 0x80 : 0;
    }
    out[i] = byte;
  }

  return buffer;
}
