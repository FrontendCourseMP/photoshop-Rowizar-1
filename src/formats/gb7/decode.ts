import type { Channel, RasterImage } from '../types';
import {
  GB7_FLAG_MASK,
  GB7_FLAG_RESERVED_BITS,
  GB7_HEADER_SIZE,
  GB7_SIGNATURE,
  GB7_VERSION,
} from './spec';

/**
 * Decode a GB7 file into a RasterImage. The header is validated against the
 * spec; on any deviation we throw a precise error message so the UI can
 * surface it in a toast instead of a generic "bad file".
 */
export function decodeGB7(buffer: ArrayBuffer): RasterImage {
  if (buffer.byteLength < GB7_HEADER_SIZE) {
    throw new Error('Invalid GB7: header truncated');
  }

  const view = new DataView(buffer);

  for (let i = 0; i < GB7_SIGNATURE.length; i++) {
    if (view.getUint8(i) !== GB7_SIGNATURE[i]) {
      throw new Error('Invalid GB7: bad signature');
    }
  }

  const version = view.getUint8(4);
  if (version !== GB7_VERSION) {
    throw new Error(`Unsupported GB7 version: ${version}`);
  }

  const flags = view.getUint8(5);
  if ((flags & GB7_FLAG_RESERVED_BITS) !== 0) {
    throw new Error('Invalid GB7: reserved flag bits');
  }
  const hasMask = (flags & GB7_FLAG_MASK) !== 0;

  const width = view.getUint16(6, false);
  const height = view.getUint16(8, false);

  const pixelCount = width * height;
  if (buffer.byteLength < GB7_HEADER_SIZE + pixelCount) {
    throw new Error('Invalid GB7: pixel data truncated');
  }

  const src = new Uint8Array(buffer, GB7_HEADER_SIZE, pixelCount);
  const pixels = new Uint8ClampedArray(pixelCount * 4);

  for (let i = 0; i < pixelCount; i++) {
    const byte = src[i]!;
    const g7 = byte & 0x7f;
    // bit-replication: (g7 << 1) | (g7 >> 6) maps [0..127] → [0..255] exactly.
    const g8 = ((g7 << 1) | (g7 >> 6)) & 0xff;
    const alpha = hasMask ? ((byte & 0x80) !== 0 ? 255 : 0) : 255;
    const o = i * 4;
    pixels[o] = g8;
    pixels[o + 1] = g8;
    pixels[o + 2] = g8;
    pixels[o + 3] = alpha;
  }

  const channels: Channel[] = hasMask ? ['Gray', 'A'] : ['Gray'];

  return {
    width,
    height,
    pixels,
    meta: {
      format: 'gb7',
      bitDepth: 7,
      channels,
      hasMask,
    },
  };
}
