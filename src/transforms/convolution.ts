import type { Channel, RasterImage } from '../formats/types';

/**
 * Strategy for sampling pixels outside the image bounds during convolution.
 *  - 'black' → out-of-bounds reads return 0.
 *  - 'white' → out-of-bounds reads return 255.
 *  - 'clamp' → out-of-bounds coordinates clamp to the nearest edge pixel.
 *
 * Task spec lists exactly these three. Mirror/wrap are intentionally absent.
 */
export type EdgeMode = 'black' | 'white' | 'clamp';

/**
 * 3×3 kernel laid out row-major:
 *   [a, b, c,
 *    d, e, f,
 *    g, h, i]
 * Each element is multiplied by the source pixel at the corresponding offset
 * relative to the centre. Results are clamped to [0, 255] per channel.
 */
export type Kernel3x3 = Readonly<[number, number, number, number, number, number, number, number, number]>;

export type ConvolutionParams = {
  kernel: Kernel3x3;
  /** Semantic channels enabled for processing. Anything not in this set is
   *  copied from the source byte unchanged. For a grayscale image, enabling
   *  'Gray' means all three RGB byte slots get convolved (they're equal in
   *  the source, so the output stays grayscale). */
  channels: ReadonlySet<Channel>;
  edgeMode: EdgeMode;
};

export const IDENTITY_KERNEL: Kernel3x3 = [0, 0, 0, 0, 1, 0, 0, 0, 0] as const;

export function isIdentityKernel(k: Kernel3x3): boolean {
  return (
    k[0] === 0 &&
    k[1] === 0 &&
    k[2] === 0 &&
    k[3] === 0 &&
    k[4] === 1 &&
    k[5] === 0 &&
    k[6] === 0 &&
    k[7] === 0 &&
    k[8] === 0
  );
}

/**
 * Apply a 3×3 convolution kernel to the image. Pure function, no canvas
 * involvement. The output has the same dimensions as the input — edge handling
 * is done at sample-time, not by physically padding the image.
 *
 * Identity short-circuits to the source RasterImage (no copy). Otherwise we
 * walk every output pixel and, for each byte slot enabled by `channels`,
 * compute the weighted sum over the 3×3 neighbourhood, clamp to [0, 255], and
 * write it. Disabled byte slots are copied verbatim from the source so the
 * user's "convolve only R" intent never silently zeroes G/B.
 */
export function applyConvolution(image: RasterImage, params: ConvolutionParams): RasterImage {
  if (isIdentityKernel(params.kernel)) return image;

  const width = image.width;
  const height = image.height;
  const src = image.pixels;
  const out = new Uint8ClampedArray(width * height * 4);
  const offsets = byteOffsetsForChannels(image, params.channels);
  const k = params.kernel;
  const edgeMode = params.edgeMode;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pix = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        if (offsets.has(c)) {
          let acc = 0;
          // 3×3 neighbourhood, row-major matching kernel layout.
          acc += sampleByte(src, x - 1, y - 1, width, height, c, edgeMode) * k[0]!;
          acc += sampleByte(src, x,     y - 1, width, height, c, edgeMode) * k[1]!;
          acc += sampleByte(src, x + 1, y - 1, width, height, c, edgeMode) * k[2]!;
          acc += sampleByte(src, x - 1, y,     width, height, c, edgeMode) * k[3]!;
          acc += sampleByte(src, x,     y,     width, height, c, edgeMode) * k[4]!;
          acc += sampleByte(src, x + 1, y,     width, height, c, edgeMode) * k[5]!;
          acc += sampleByte(src, x - 1, y + 1, width, height, c, edgeMode) * k[6]!;
          acc += sampleByte(src, x,     y + 1, width, height, c, edgeMode) * k[7]!;
          acc += sampleByte(src, x + 1, y + 1, width, height, c, edgeMode) * k[8]!;
          out[pix + c] = acc;
        } else {
          out[pix + c] = src[pix + c]!;
        }
      }
    }
  }

  return {
    width,
    height,
    pixels: out,
    meta: image.meta,
  };
}

/**
 * Map semantic Channel selection into the set of byte offsets (0=R, 1=G, 2=B,
 * 3=A) to actually convolve. Special case: a grayscale image stores its data
 * equally in R, G, B byte slots, so enabling 'Gray' enables all three.
 */
function byteOffsetsForChannels(image: RasterImage, channels: ReadonlySet<Channel>): Set<number> {
  const offsets = new Set<number>();
  const isGray = image.meta.channels.includes('Gray');
  if (isGray && channels.has('Gray')) {
    offsets.add(0);
    offsets.add(1);
    offsets.add(2);
  } else {
    if (channels.has('R')) offsets.add(0);
    if (channels.has('G')) offsets.add(1);
    if (channels.has('B')) offsets.add(2);
  }
  if (channels.has('A')) offsets.add(3);
  return offsets;
}

function sampleByte(
  src: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number,
  channelOffset: number,
  edgeMode: EdgeMode,
): number {
  if (x >= 0 && x < width && y >= 0 && y < height) {
    return src[(y * width + x) * 4 + channelOffset]!;
  }
  switch (edgeMode) {
    case 'black':
      return 0;
    case 'white':
      return 255;
    case 'clamp': {
      const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
      const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
      return src[(cy * width + cx) * 4 + channelOffset]!;
    }
  }
}
