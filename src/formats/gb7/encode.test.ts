import { describe, expect, it } from 'vitest';
import { decodeGB7 } from './decode';
import { encodeGB7 } from './encode';
import { GB7_HEADER_SIZE, GB7_SIGNATURE, GB7_VERSION } from './spec';
import type { RasterImage } from '../types';

function makeGray(width: number, height: number, grays: number[], alphas?: number[]): RasterImage {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const g = grays[i] ?? 0;
    const a = alphas?.[i] ?? 255;
    const o = i * 4;
    pixels[o] = g;
    pixels[o + 1] = g;
    pixels[o + 2] = g;
    pixels[o + 3] = a;
  }
  return {
    width,
    height,
    pixels,
    meta: { format: 'gb7', bitDepth: 8 },
  };
}

describe('encodeGB7', () => {
  it('writes a valid header (signature, version, flags, dimensions)', () => {
    const buf = encodeGB7(makeGray(3, 5, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    const view = new DataView(buf);
    for (let i = 0; i < GB7_SIGNATURE.length; i++) {
      expect(view.getUint8(i)).toBe(GB7_SIGNATURE[i]);
    }
    expect(view.getUint8(4)).toBe(GB7_VERSION);
    expect(view.getUint8(5)).toBe(0); // no mask
    expect(view.getUint16(6, false)).toBe(3);
    expect(view.getUint16(8, false)).toBe(5);
    expect(view.getUint16(10, false)).toBe(0);
    expect(buf.byteLength).toBe(GB7_HEADER_SIZE + 15);
  });

  it('quantises gray8 to gray7 with shift', () => {
    const buf = encodeGB7(makeGray(2, 2, [0, 2, 126, 255]));
    const out = new Uint8Array(buf, GB7_HEADER_SIZE);
    expect([...out]).toEqual([0, 1, 63, 127]);
  });

  it('sets mask flag and bit 7 when includeMask is true', () => {
    const buf = encodeGB7(
      makeGray(2, 2, [255, 255, 0, 0], [255, 0, 255, 127]),
      { includeMask: true },
    );
    const view = new DataView(buf);
    expect(view.getUint8(5) & 0x01).toBe(1);
    const out = new Uint8Array(buf, GB7_HEADER_SIZE);
    expect(out[0]! & 0x80).toBe(0x80); // alpha 255
    expect(out[1]! & 0x80).toBe(0); // alpha 0
    expect(out[2]! & 0x80).toBe(0x80); // alpha 255
    expect(out[3]! & 0x80).toBe(0); // alpha 127 → mask 0 (threshold 128)
  });

  it('composites partially-transparent pixels onto white when mask is off', () => {
    // alpha=0 pixel with rgb=0,0,0 should become white (255) before quantisation
    const buf = encodeGB7(makeGray(1, 1, [0], [0]));
    const out = new Uint8Array(buf, GB7_HEADER_SIZE);
    expect(out[0]).toBe(127); // 255 >> 1
  });
});

describe('GB7 round-trip', () => {
  it('decode(encode(decode(buf))) preserves bytes (no mask)', () => {
    const original = new Uint8Array([0x00, 0x01, 0x3f, 0x7f]);
    const buffer = new ArrayBuffer(GB7_HEADER_SIZE + 4);
    const view = new DataView(buffer);
    for (let i = 0; i < GB7_SIGNATURE.length; i++) view.setUint8(i, GB7_SIGNATURE[i]!);
    view.setUint8(4, GB7_VERSION);
    view.setUint8(5, 0);
    view.setUint16(6, 2, false);
    view.setUint16(8, 2, false);
    new Uint8Array(buffer, GB7_HEADER_SIZE).set(original);

    const decoded = decodeGB7(buffer);
    const reencoded = encodeGB7(decoded);

    expect(new Uint8Array(reencoded)).toEqual(new Uint8Array(buffer));
  });

  it('decode(encode(decode(buf))) preserves bytes (with mask)', () => {
    const original = new Uint8Array([0xff, 0x7f, 0x80, 0x00]);
    const buffer = new ArrayBuffer(GB7_HEADER_SIZE + 4);
    const view = new DataView(buffer);
    for (let i = 0; i < GB7_SIGNATURE.length; i++) view.setUint8(i, GB7_SIGNATURE[i]!);
    view.setUint8(4, GB7_VERSION);
    view.setUint8(5, 0x01);
    view.setUint16(6, 2, false);
    view.setUint16(8, 2, false);
    new Uint8Array(buffer, GB7_HEADER_SIZE).set(original);

    const decoded = decodeGB7(buffer);
    const reencoded = encodeGB7(decoded);

    expect(new Uint8Array(reencoded)).toEqual(new Uint8Array(buffer));
  });
});
