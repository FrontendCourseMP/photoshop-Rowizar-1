import { describe, expect, it } from 'vitest';
import { parsePngChannels } from './header';

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR_BYTES = [0x49, 0x48, 0x44, 0x52];

function buildPng(colorType: number): ArrayBuffer {
  // 8 sig + 4 chunkLen + 4 chunkType + 13 IHDR data + 4 CRC = 33 bytes minimum
  const buf = new Uint8Array(33);
  buf.set(PNG_SIG, 0);
  // chunk length = 13 (big-endian)
  buf[8] = 0;
  buf[9] = 0;
  buf[10] = 0;
  buf[11] = 13;
  buf.set(IHDR_BYTES, 12);
  // width = 1 (offset 16..19), height = 1 (offset 20..23), depth=8 (offset 24)
  buf[19] = 1;
  buf[23] = 1;
  buf[24] = 8;
  buf[25] = colorType;
  // 26 = compression, 27 = filter, 28 = interlace — all zero is fine
  // 29..32 = CRC (we don't verify)
  return buf.buffer;
}

describe('parsePngChannels', () => {
  it('maps color type 0 to [Gray]', () => {
    expect(parsePngChannels(buildPng(0))).toEqual(['Gray']);
  });

  it('maps color type 2 to [R, G, B]', () => {
    expect(parsePngChannels(buildPng(2))).toEqual(['R', 'G', 'B']);
  });

  it('maps palette (color type 3) to [R, G, B]', () => {
    expect(parsePngChannels(buildPng(3))).toEqual(['R', 'G', 'B']);
  });

  it('maps color type 4 to [Gray, A]', () => {
    expect(parsePngChannels(buildPng(4))).toEqual(['Gray', 'A']);
  });

  it('maps color type 6 to [R, G, B, A]', () => {
    expect(parsePngChannels(buildPng(6))).toEqual(['R', 'G', 'B', 'A']);
  });

  it('throws on truncated header', () => {
    const tiny = new ArrayBuffer(10);
    expect(() => parsePngChannels(tiny)).toThrow(/header truncated/);
  });

  it('throws on bad signature', () => {
    const buf = buildPng(2);
    new DataView(buf).setUint8(0, 0xff);
    expect(() => parsePngChannels(buf)).toThrow(/bad signature/);
  });

  it('throws when first chunk is not IHDR', () => {
    const buf = buildPng(2);
    new DataView(buf).setUint8(12, 0x66); // mangle chunk type
    expect(() => parsePngChannels(buf)).toThrow(/IHDR must be the first chunk/);
  });

  it('throws on unknown color type', () => {
    expect(() => parsePngChannels(buildPng(5))).toThrow(/unknown color type 5/);
  });
});
