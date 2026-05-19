import type { Channel, RasterImage, SourceFormat } from '../types';
import { parsePngChannels } from '../png/header';
import { parseJpegChannels } from '../jpeg/header';

/** Enough bytes to walk JPEG segments to SOF in any realistic file. */
const HEADER_READ_SIZE = 65536;

/**
 * Decode PNG or JPEG via the browser's built-in image pipeline. This is
 * explicitly allowed by the assignment: PNG/JPEG handling is "a browser
 * capability", whereas raw pixel parsing libraries are not allowed.
 *
 * We do parse the file header ourselves first (PNG IHDR, JPEG SOF) to recover
 * the semantic channel list — the browser pipeline always returns RGBA and
 * loses that information.
 */
export async function decodeBrowser(
  file: File,
  format: SourceFormat,
): Promise<RasterImage> {
  if (format !== 'png' && format !== 'jpeg') {
    throw new Error(`decodeBrowser does not handle format: ${format}`);
  }

  const headerBuf = await file.slice(0, HEADER_READ_SIZE).arrayBuffer();
  const channels: Channel[] =
    format === 'png' ? parsePngChannels(headerBuf) : parseJpegChannels(headerBuf);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Failed to decode ${format.toUpperCase()}: file is corrupt or unsupported`);
  }

  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return {
      width: bitmap.width,
      height: bitmap.height,
      pixels: imageData.data,
      meta: { format, bitDepth: 8, channels },
    };
  } finally {
    bitmap.close();
  }
}
