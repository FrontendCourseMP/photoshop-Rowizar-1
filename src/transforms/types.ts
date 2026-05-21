import type { Channel } from '../formats/types';
import type { ConvolutionParams } from './convolution';
import type { LevelsBag } from './levels';

/**
 * Per-channel enable/disable map. Always carries entries for every Channel —
 * channels not present in a given RasterImage just go ignored when the mask
 * is applied, so a single ChannelMask value works for any image shape.
 */
export type ChannelMask = Record<Channel, boolean>;

/**
 * Composable view-time transforms applied to sourceImage before it lands on
 * the canvas. Each entry is independent and short-circuits to identity when
 * it has nothing to do. applyPipeline composes them in a fixed order
 * (see apply.ts).
 *
 * View-only by contract: Save As exports sourceImage, never the pipelined
 * result. Destructive Apply (Levels, Convolution) bakes its result into
 * sourceImage and clears its pipeline slot.
 */
export type Pipeline = {
  channelMask: ChannelMask;
  levels: LevelsBag | null;
  convolution: ConvolutionParams | null;
};

export const FULL_CHANNEL_MASK: ChannelMask = {
  R: true,
  G: true,
  B: true,
  A: true,
  Gray: true,
};

export const DEFAULT_PIPELINE: Pipeline = {
  channelMask: { ...FULL_CHANNEL_MASK },
  levels: null,
  convolution: null,
};
