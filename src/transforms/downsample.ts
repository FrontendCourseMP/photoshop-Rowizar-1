import type { RasterImage } from '../formats/types';

/**
 * Return a downsampled copy of the image whose longest side is at most
 * maxDimension. Images already small enough are returned as-is.
 *
 * Used by the Levels preview pipeline: applyLevels on a 4K image (~8M
 * pixels) costs ~300 ms per pass and stutters during slider drag. Running
 * the live preview through a 1500-pixel-long copy drops that to ~20 ms and
 * keeps the UI responsive. Apply still bakes into the full-resolution
 * sourceImage, so the saved file is unaffected.
 *
 * Resampling goes through OffscreenCanvas drawImage with high-quality
 * smoothing — same precedent as our other browser-pipeline use.
 */
export function downsampleImage(
  image: RasterImage,
  maxDimension: number,
): RasterImage {
  const longest = Math.max(image.width, image.height);
  if (longest <= maxDimension) return image;

  const scale = maxDimension / longest;
  const newW = Math.max(1, Math.round(image.width * scale));
  const newH = Math.max(1, Math.round(image.height * scale));

  const srcCanvas = new OffscreenCanvas(image.width, image.height);
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) return image;
  srcCtx.putImageData(
    new ImageData(image.pixels, image.width, image.height),
    0,
    0,
  );

  const tgtCanvas = new OffscreenCanvas(newW, newH);
  const tgtCtx = tgtCanvas.getContext('2d');
  if (!tgtCtx) return image;
  tgtCtx.imageSmoothingEnabled = true;
  tgtCtx.imageSmoothingQuality = 'high';
  tgtCtx.drawImage(srcCanvas, 0, 0, newW, newH);

  const data = tgtCtx.getImageData(0, 0, newW, newH);
  return {
    width: newW,
    height: newH,
    pixels: data.data,
    meta: image.meta,
  };
}
