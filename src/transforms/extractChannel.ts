import type { Channel, RasterImage } from '../formats/types';

/**
 * Pull one channel out of an RGBA image and render it as a grayscale buffer
 * (R=G=B=value, alpha=255). Used by ChannelsPanel for per-channel thumbnails.
 *
 * Grayscale is the standard channel-preview style in image editors — it lets
 * the viewer compare channel intensities without colour-cue interference.
 * The assignment leaves the choice to the implementer but recommends gray.
 *
 * For Channel='Gray' we read the R component, which is identical to G and B
 * for grayscale-decoded images.
 */
export function extractChannelAsGrayscale(
  image: RasterImage,
  channel: Channel,
): Uint8ClampedArray<ArrayBuffer> {
  const offset = channel === 'A' ? 3 : channel === 'G' ? 1 : channel === 'B' ? 2 : 0;
  const src = image.pixels;
  const pixelCount = image.width * image.height;
  const out = new Uint8ClampedArray(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const v = src[o + offset]!;
    out[o] = v;
    out[o + 1] = v;
    out[o + 2] = v;
    out[o + 3] = 255;
  }
  return out;
}
