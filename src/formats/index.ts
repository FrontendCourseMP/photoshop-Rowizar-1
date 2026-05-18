import type { SourceFormat } from './types';
import { GB7_SIGNATURE } from './gb7/spec';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_SOI = [0xff, 0xd8, 0xff] as const;

function matches(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Detect image format by reading the first few bytes of the file. Extension is
 * ignored: a file named foo.png that starts with FF D8 FF is a JPEG.
 */
export async function detectFormat(file: File): Promise<SourceFormat | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (matches(head, GB7_SIGNATURE)) return 'gb7';
  if (matches(head, PNG_SIGNATURE)) return 'png';
  if (matches(head, JPEG_SOI)) return 'jpeg';
  return null;
}

export type { RasterImage, SourceFormat } from './types';
