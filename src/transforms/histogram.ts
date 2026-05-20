import type { Channel, RasterImage } from '../formats/types';

/**
 * Histogram source: either the composite lightness channel or one of the
 * image's existing per-pixel channels (R/G/B/A/Gray). 'Gray' is treated the
 * same as 'R' because grayscale-decoded images carry R=G=B.
 */
export type HistogramSource = 'lightness' | Channel;

/**
 * Compute a 256-bin histogram over the chosen source.
 *
 * The composite histogram uses HSL lightness — (max(R,G,B) + min(R,G,B)) / 2
 * — because the assignment uses the term "светлота" (literally "lightness"),
 * which by the HSL/Lab definition matches this formula. Luma (Rec.601) would
 * be the equivalent for "яркость". Picking lightness over luma also means
 * pure saturated colours land in the middle of the histogram rather than
 * being smashed into a small "perceptual weight" range, which is more useful
 * for Levels-style editing.
 *
 * Bins are always 256 wide regardless of source format. For GB7 (7-bit data
 * stretched to 8-bit by bit-replication) you will see a comb pattern with
 * empty bins between filled ones — that is the honest visualisation of
 * 7-bit data in 8-bit space.
 */
export function computeHistogram(
  image: RasterImage,
  source: HistogramSource,
): Uint32Array {
  const bins = new Uint32Array(256);
  const px = image.pixels;
  const count = image.width * image.height;

  if (source === 'lightness') {
    for (let i = 0; i < count; i++) {
      const o = i * 4;
      const r = px[o]!;
      const g = px[o + 1]!;
      const b = px[o + 2]!;
      const max = r > g ? (r > b ? r : b) : g > b ? g : b;
      const min = r < g ? (r < b ? r : b) : g < b ? g : b;
      bins[(max + min) >> 1]!++;
    }
  } else {
    const offset = channelByteOffset(source);
    for (let i = 0; i < count; i++) {
      bins[px[i * 4 + offset]!]!++;
    }
  }

  return bins;
}

function channelByteOffset(ch: Channel): number {
  switch (ch) {
    case 'R':
    case 'Gray':
      return 0;
    case 'G':
      return 1;
    case 'B':
      return 2;
    case 'A':
      return 3;
  }
}
