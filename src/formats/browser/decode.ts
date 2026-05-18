import type { RasterImage, SourceFormat } from '../types';

/**
 * Decode PNG or JPEG via the browser's built-in image pipeline. This is
 * explicitly allowed by the assignment: PNG/JPEG handling is "a browser
 * capability", whereas raw pixel parsing libraries are not allowed.
 */
export async function decodeBrowser(
  file: File,
  format: SourceFormat,
): Promise<RasterImage> {
  if (format !== 'png' && format !== 'jpeg') {
    throw new Error(`decodeBrowser does not handle format: ${format}`);
  }

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
      meta: { format, bitDepth: 8 },
    };
  } finally {
    bitmap.close();
  }
}
