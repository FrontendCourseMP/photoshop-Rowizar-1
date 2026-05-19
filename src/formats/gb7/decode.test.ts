import { describe, expect, it } from 'vitest';
import { decodeGB7 } from './decode';
import { GB7_HEADER_SIZE, GB7_SIGNATURE, GB7_VERSION } from './spec';

function buildBuffer(
  width: number,
  height: number,
  flags: number,
  pixels: number[],
  options: { headerSize?: number } = {},
): ArrayBuffer {
  const headerSize = options.headerSize ?? GB7_HEADER_SIZE;
  const buffer = new ArrayBuffer(headerSize + pixels.length);
  const view = new DataView(buffer);
  if (headerSize >= 4) {
    for (let i = 0; i < GB7_SIGNATURE.length; i++) view.setUint8(i, GB7_SIGNATURE[i]!);
  }
  if (headerSize > 4) view.setUint8(4, GB7_VERSION);
  if (headerSize > 5) view.setUint8(5, flags);
  if (headerSize > 7) view.setUint16(6, width, false);
  if (headerSize > 9) view.setUint16(8, height, false);
  if (headerSize > 11) view.setUint16(10, 0, false);
  const out = new Uint8Array(buffer, headerSize);
  for (let i = 0; i < pixels.length; i++) out[i] = pixels[i]!;
  return buffer;
}

describe('decodeGB7', () => {
  it('decodes 2x2 grayscale without mask using bit-replication', () => {
    // g7 = 0, 1, 63, 127 → g8 = 0, 2, 126, 255
    const img = decodeGB7(buildBuffer(2, 2, 0, [0x00, 0x01, 0x3f, 0x7f]));
    expect(img.width).toBe(2);
    expect(img.height).toBe(2);
    expect(img.meta).toEqual({
      format: 'gb7',
      bitDepth: 7,
      channels: ['Gray'],
      hasMask: false,
    });

    const expectedG8 = [0, 2, 126, 255];
    for (let i = 0; i < 4; i++) {
      const o = i * 4;
      expect(img.pixels[o]).toBe(expectedG8[i]);
      expect(img.pixels[o + 1]).toBe(expectedG8[i]);
      expect(img.pixels[o + 2]).toBe(expectedG8[i]);
      expect(img.pixels[o + 3]).toBe(255);
    }
  });

  it('decodes 2x2 with mask: bit7=1 opaque, bit7=0 transparent', () => {
    // pixel: 0x80 | g7
    const img = decodeGB7(
      buildBuffer(2, 2, 0x01, [0x80 | 0x7f, 0x00 | 0x7f, 0x80 | 0x00, 0x00 | 0x00]),
    );
    expect(img.meta.hasMask).toBe(true);
    expect(img.meta.channels).toEqual(['Gray', 'A']);
    expect(img.pixels[3]).toBe(255); // opaque
    expect(img.pixels[7]).toBe(0); // transparent (g7=127 but masked)
    expect(img.pixels[11]).toBe(255); // opaque (g7=0)
    expect(img.pixels[15]).toBe(0); // transparent (g7=0)
    expect(img.pixels[0]).toBe(255); // g7=127 → 255
    expect(img.pixels[8]).toBe(0); // g7=0 → 0
  });

  it('throws "header truncated" for short input', () => {
    const tiny = new ArrayBuffer(10);
    expect(() => decodeGB7(tiny)).toThrow(/header truncated/);
  });

  it('throws "bad signature" when first 4 bytes are wrong', () => {
    const buf = buildBuffer(1, 1, 0, [0]);
    new DataView(buf).setUint8(0, 0xff);
    expect(() => decodeGB7(buf)).toThrow(/bad signature/);
  });

  it('throws on unsupported version', () => {
    const buf = buildBuffer(1, 1, 0, [0]);
    new DataView(buf).setUint8(4, 0x02);
    expect(() => decodeGB7(buf)).toThrow(/Unsupported GB7 version: 2/);
  });

  it('throws on reserved flag bits', () => {
    const buf = buildBuffer(1, 1, 0b0000_0010, [0]);
    expect(() => decodeGB7(buf)).toThrow(/reserved flag bits/);
  });

  it('throws when pixel data is truncated', () => {
    // Declare 4 pixels but only provide 2
    const buf = buildBuffer(2, 2, 0, [0x10, 0x20]);
    expect(() => decodeGB7(buf)).toThrow(/pixel data truncated/);
  });
});
