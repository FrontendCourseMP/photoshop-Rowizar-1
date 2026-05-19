import type { Channel } from '../types';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

// Layout: signature(8) + chunkLength(4) + chunkType("IHDR", 4) + chunkData(13)
//   chunkData: width(4) + height(4) + bitDepth(1) + colorType(1) + ...
const IHDR_TYPE_OFFSET = 12;
const COLOR_TYPE_OFFSET = 25;

/**
 * Read the PNG IHDR chunk and return the semantic channel list. We only
 * touch the header bytes (~26 bytes), pixel data is left to the browser
 * decoder — same precedent as GB7: parsing metadata is allowed, parsing
 * pixels would be a third-party-codec violation.
 *
 * Color types per PNG spec §11.2.2:
 *   0 = Grayscale          → ['Gray']
 *   2 = Truecolor          → ['R', 'G', 'B']
 *   3 = Indexed (palette)  → ['R', 'G', 'B']  (browser expands PLTE on decode)
 *   4 = Grayscale + alpha  → ['Gray', 'A']
 *   6 = Truecolor + alpha  → ['R', 'G', 'B', 'A']
 */
export function parsePngChannels(buffer: ArrayBuffer): Channel[] {
  if (buffer.byteLength < COLOR_TYPE_OFFSET + 1) {
    throw new Error('Invalid PNG: header truncated');
  }
  const view = new DataView(buffer);

  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (view.getUint8(i) !== PNG_SIGNATURE[i]) {
      throw new Error('Invalid PNG: bad signature');
    }
  }

  const t0 = view.getUint8(IHDR_TYPE_OFFSET);
  const t1 = view.getUint8(IHDR_TYPE_OFFSET + 1);
  const t2 = view.getUint8(IHDR_TYPE_OFFSET + 2);
  const t3 = view.getUint8(IHDR_TYPE_OFFSET + 3);
  if (t0 !== 0x49 || t1 !== 0x48 || t2 !== 0x44 || t3 !== 0x52) {
    throw new Error('Invalid PNG: IHDR must be the first chunk');
  }

  const colorType = view.getUint8(COLOR_TYPE_OFFSET);
  switch (colorType) {
    case 0:
      return ['Gray'];
    case 2:
      return ['R', 'G', 'B'];
    case 3:
      return ['R', 'G', 'B'];
    case 4:
      return ['Gray', 'A'];
    case 6:
      return ['R', 'G', 'B', 'A'];
    default:
      throw new Error(`Invalid PNG: unknown color type ${colorType}`);
  }
}
