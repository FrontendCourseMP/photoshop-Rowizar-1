import { describe, expect, it } from 'vitest';
import { parseJpegChannels } from './header';

/**
 * Build a minimal JPEG: SOI + optional APP0 + SOFn. The SOF segment carries
 * Nf — the only thing the parser actually reads — so component info bytes
 * after it can be zeros.
 */
function buildJpeg(options: {
  nf: number;
  sofMarker?: number; // default 0xC0 (SOF0)
  withApp0?: boolean;
  paddingFFs?: boolean;
}): ArrayBuffer {
  const { nf, sofMarker = 0xc0, withApp0 = false, paddingFFs = false } = options;
  const bytes: number[] = [0xff, 0xd8]; // SOI

  if (withApp0) {
    // APP0 with 16 bytes of data (JFIF-ish): FF E0 LL LL ...14 bytes of payload
    const app0Len = 16;
    bytes.push(0xff, 0xe0, (app0Len >> 8) & 0xff, app0Len & 0xff);
    for (let k = 0; k < app0Len - 2; k++) bytes.push(0x00);
  }

  // SOF segment: FF Cn LL LL P Y Y X X Nf [comp*3]*Nf
  const sofLen = 8 + nf * 3;
  if (paddingFFs) bytes.push(0xff);
  bytes.push(0xff, sofMarker);
  bytes.push((sofLen >> 8) & 0xff, sofLen & 0xff);
  bytes.push(8); // precision
  bytes.push(0, 1); // height
  bytes.push(0, 1); // width
  bytes.push(nf);
  for (let k = 0; k < nf * 3; k++) bytes.push(0x00);

  return new Uint8Array(bytes).buffer;
}

describe('parseJpegChannels', () => {
  it('maps Nf=1 to [Gray]', () => {
    expect(parseJpegChannels(buildJpeg({ nf: 1 }))).toEqual(['Gray']);
  });

  it('maps Nf=3 to [R, G, B]', () => {
    expect(parseJpegChannels(buildJpeg({ nf: 3 }))).toEqual(['R', 'G', 'B']);
  });

  it('throws on CMYK (Nf=4)', () => {
    expect(() => parseJpegChannels(buildJpeg({ nf: 4 }))).toThrow(/CMYK/);
  });

  it('walks past APP0 to find SOF', () => {
    expect(parseJpegChannels(buildJpeg({ nf: 3, withApp0: true }))).toEqual([
      'R',
      'G',
      'B',
    ]);
  });

  it('tolerates fill 0xFF bytes before the marker', () => {
    expect(parseJpegChannels(buildJpeg({ nf: 3, paddingFFs: true }))).toEqual([
      'R',
      'G',
      'B',
    ]);
  });

  it('recognises SOF2 (progressive) just like SOF0', () => {
    expect(
      parseJpegChannels(buildJpeg({ nf: 3, sofMarker: 0xc2 })),
    ).toEqual(['R', 'G', 'B']);
  });

  it('throws on bad SOI', () => {
    const buf = new Uint8Array([0xff, 0xff, 0x00, 0x00]).buffer;
    expect(() => parseJpegChannels(buf)).toThrow(/bad SOI/);
  });

  it('throws on truncated input', () => {
    expect(() => parseJpegChannels(new ArrayBuffer(2))).toThrow(/header truncated|SOF marker not found/);
  });
});
