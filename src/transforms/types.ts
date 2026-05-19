import type { Channel } from '../formats/types';

/**
 * Per-channel enable/disable map. Always carries entries for every Channel —
 * channels not present in a given RasterImage just go ignored when the mask
 * is applied, so a single ChannelMask value works for any image shape.
 */
export type ChannelMask = Record<Channel, boolean>;

/**
 * Composable view-time transforms applied to sourceImage before it lands on
 * the canvas. ChannelMask is currently the only entry; future filters
 * (lab-3+) extend this shape, and applyPipeline composes them in order.
 *
 * Note: pipeline is **view-only** — Save As exports sourceImage, not the
 * pipelined result. When destructive edits arrive, they will live in a
 * separate edit stack, not here.
 */
export type Pipeline = {
  channelMask: ChannelMask;
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
};
