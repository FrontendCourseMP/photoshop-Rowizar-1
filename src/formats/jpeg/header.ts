import type { Channel } from '../types';

/**
 * Scan a JPEG file's segment chain until the SOF (Start Of Frame) marker is
 * found, then read the component count (Nf). Same rationale as the PNG and
 * GB7 parsers — we touch only header metadata, the actual pixel data is
 * decoded by the browser pipeline.
 *
 * JPEG marker bytes are 0xFF followed by a non-FF, non-zero byte. SOF markers
 * are 0xFFC0..0xFFCF, except 0xFFC4 (DHT) and 0xFFC8 (JPG-reserved). Nf is
 * located 7 bytes after the marker: [length:2][P:1][Y:2][X:2][Nf:1].
 *
 * Nf to channels:
 *   1 → ['Gray']           (grayscale JPEG, rare but legal)
 *   3 → ['R', 'G', 'B']    (most JPEGs — YCbCr internally, browser returns RGB)
 *   4 → CMYK, throws       (not supported by the assignment scope)
 */
export function parseJpegChannels(buffer: ArrayBuffer): Channel[] {
  if (buffer.byteLength < 4) {
    throw new Error('Invalid JPEG: header truncated');
  }
  const view = new DataView(buffer);
  if (view.getUint8(0) !== 0xff || view.getUint8(1) !== 0xd8) {
    throw new Error('Invalid JPEG: bad SOI');
  }

  let i = 2;
  while (i + 1 < buffer.byteLength) {
    // Markers may be preceded by fill 0xFF bytes — skip extra FFs.
    while (i + 1 < buffer.byteLength && view.getUint8(i) === 0xff && view.getUint8(i + 1) === 0xff) {
      i++;
    }
    if (view.getUint8(i) !== 0xff) {
      throw new Error(`Invalid JPEG: expected marker at offset ${i}`);
    }
    const marker = view.getUint8(i + 1);
    i += 2;

    // Standalone markers (no length payload): TEM (01), RSTn (D0..D7), SOI (D8).
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (marker === 0xd9) {
      throw new Error('Invalid JPEG: EOI reached before SOF');
    }

    if (i + 2 > buffer.byteLength) {
      throw new Error('Invalid JPEG: truncated segment header');
    }
    const segLen = view.getUint16(i, false);

    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8;
    if (isSof) {
      // Segment layout from offset i: [length:2][P:1][Y:2][X:2][Nf:1][...]
      if (i + 8 > buffer.byteLength) {
        throw new Error('Invalid JPEG: SOF segment truncated');
      }
      const nf = view.getUint8(i + 7);
      switch (nf) {
        case 1:
          return ['Gray'];
        case 3:
          return ['R', 'G', 'B'];
        case 4:
          throw new Error('Unsupported JPEG: CMYK (4 components) not handled');
        default:
          throw new Error(`Invalid JPEG: unexpected component count Nf=${nf}`);
      }
    }

    i += segLen;
  }
  throw new Error('Invalid JPEG: SOF marker not found');
}
