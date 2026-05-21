import type { RasterImage } from '../formats/types';
import type { Pipeline } from './types';
import { applyChannelMask } from './channelMask';
import { applyConvolution } from './convolution';
import { applyLevels } from './levels';

/**
 * Compose every transform in the view pipeline.
 *
 * Order: levels → convolution → channel mask. Tonal pre-correction first,
 * then the filter that operates on those corrected pixels, then the channel
 * mask which is a view-only display modifier — placing it last means its
 * "alpha-only mask view" reflects everything that came before. Each step is
 * pure RasterImage → RasterImage and short-circuits to its input on identity
 * params, so an idle pipeline costs nothing.
 */
export function applyPipeline(image: RasterImage, pipeline: Pipeline): RasterImage {
  let result = image;
  if (pipeline.levels) result = applyLevels(result, pipeline.levels);
  if (pipeline.convolution) result = applyConvolution(result, pipeline.convolution);
  result = applyChannelMask(result, pipeline.channelMask);
  return result;
}
