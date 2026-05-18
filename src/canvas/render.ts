import type { RasterImage } from '../formats/types';

/**
 * Render a RasterImage onto a canvas at its native pixel size.
 *
 * CSS-level scaling (fit-to-view vs 100%) is the responsibility of the parent
 * element — we draw at native size and let CSS shrink/scroll. This keeps the
 * pixel data on the canvas untouched and round-trippable.
 */
export function renderToCanvas(canvas: HTMLCanvasElement, image: RasterImage): void {
  if (canvas.width !== image.width) canvas.width = image.width;
  if (canvas.height !== image.height) canvas.height = image.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const imageData = new ImageData(image.pixels, image.width, image.height);
  ctx.putImageData(imageData, 0, 0);
}
