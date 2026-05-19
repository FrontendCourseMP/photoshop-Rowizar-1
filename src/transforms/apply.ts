import type { RasterImage } from '../formats/types';
import type { Pipeline } from './types';
import { applyChannelMask } from './channelMask';

/**
 * Compose every transform in the view pipeline. Right now there is only the
 * channel mask; lab-3+ will append filters here in a known order. Each step
 * returns RasterImage → RasterImage and never mutates its input.
 */
export function applyPipeline(image: RasterImage, pipeline: Pipeline): RasterImage {
  return applyChannelMask(image, pipeline.channelMask);
}
