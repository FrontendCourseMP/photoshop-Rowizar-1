import { describe, expect, it } from 'vitest';
import type { Channel, RasterImage } from '../formats/types';
import { applyChannelMask } from './channelMask';
import { FULL_CHANNEL_MASK, type ChannelMask } from './types';

function makeImage(
  width: number,
  height: number,
  channels: Channel[],
  pixels: number[],
): RasterImage {
  const buf = new Uint8ClampedArray(width * height * 4);
  buf.set(pixels);
  return {
    width,
    height,
    pixels: buf,
    meta: { format: 'png', bitDepth: 8, channels },
  };
}

function mask(overrides: Partial<ChannelMask>): ChannelMask {
  return { ...FULL_CHANNEL_MASK, ...overrides };
}

describe('applyChannelMask', () => {
  it('returns the source image as-is when no channel is masked off', () => {
    const img = makeImage(1, 1, ['R', 'G', 'B', 'A'], [10, 20, 30, 200]);
    const out = applyChannelMask(img, FULL_CHANNEL_MASK);
    expect(out).toBe(img);
  });

  it('zeros the green channel when G is off', () => {
    const img = makeImage(1, 1, ['R', 'G', 'B', 'A'], [10, 20, 30, 200]);
    const out = applyChannelMask(img, mask({ G: false }));
    expect([...out.pixels]).toEqual([10, 0, 30, 200]);
  });

  it('forces alpha to 255 when A is off', () => {
    const img = makeImage(1, 1, ['R', 'G', 'B', 'A'], [10, 20, 30, 100]);
    const out = applyChannelMask(img, mask({ A: false }));
    expect([...out.pixels]).toEqual([10, 20, 30, 255]);
  });

  it('renders alpha as a grayscale mask when only A is enabled', () => {
    const img = makeImage(1, 2, ['R', 'G', 'B', 'A'], [10, 20, 30, 128, 40, 50, 60, 0]);
    const out = applyChannelMask(
      img,
      mask({ R: false, G: false, B: false, A: true }),
    );
    expect([...out.pixels]).toEqual([128, 128, 128, 255, 0, 0, 0, 255]);
  });

  it('renders alpha-mask view for grayscale+alpha images too', () => {
    const img = makeImage(1, 1, ['Gray', 'A'], [100, 100, 100, 200]);
    const out = applyChannelMask(img, mask({ Gray: false, A: true }));
    expect([...out.pixels]).toEqual([200, 200, 200, 255]);
  });

  it('zeros Gray (R=G=B=0) when Gray is off on a grayscale image', () => {
    const img = makeImage(1, 1, ['Gray'], [120, 120, 120, 255]);
    const out = applyChannelMask(img, mask({ Gray: false }));
    expect([...out.pixels]).toEqual([0, 0, 0, 255]);
  });

  it('leaves channels not present in the image alone', () => {
    // RGB image (no A in meta.channels): A mask flag should be ignored.
    const img = makeImage(1, 1, ['R', 'G', 'B'], [10, 20, 30, 255]);
    const out = applyChannelMask(img, mask({ A: false, G: false }));
    expect([...out.pixels]).toEqual([10, 0, 30, 255]);
  });

  it('does not mutate the source pixel buffer', () => {
    const img = makeImage(1, 1, ['R', 'G', 'B', 'A'], [10, 20, 30, 200]);
    const snapshot = [...img.pixels];
    applyChannelMask(img, mask({ R: false }));
    expect([...img.pixels]).toEqual(snapshot);
  });
});
