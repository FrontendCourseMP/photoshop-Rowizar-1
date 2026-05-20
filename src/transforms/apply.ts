import type { RasterImage } from '../formats/types';
import type { Pipeline } from './types';
import { applyChannelMask } from './channelMask';
import { applyLevels } from './levels';

/**
 * Compose every transform in the view pipeline.
 *
 * Order matters: levels first, channel mask second. This way the channel
 * mask's "alpha-only mask view" reflects the levels-adjusted alpha rather
 * than the raw source alpha — what you see is genuinely what the levels
 * preview produces. Each step is pure RasterImage → RasterImage and
 * short-circuits to its input on identity params, so an idle pipeline
 * costs nothing.
 */
export function applyPipeline(image: RasterImage, pipeline: Pipeline): RasterImage {
  let result = image;
  if (pipeline.levels) result = applyLevels(result, pipeline.levels);
  result = applyChannelMask(result, pipeline.channelMask);
  return result;
}
