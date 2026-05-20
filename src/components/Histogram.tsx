import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export type HistogramScale = 'linear' | 'log';

type Props = {
  bins: Uint32Array;
  scale?: HistogramScale;
  /** Optional override for the bar fill via CSS; default uses currentColor. */
  className?: string;
};

/**
 * 256-bin histogram rendered as SVG bars. Bars are 1 unit wide inside a
 * fixed 256-wide viewBox and the SVG stretches via preserveAspectRatio=none,
 * so any container width works without rescaling pixels in the chart logic.
 * One rect per bin (256 nodes total) is well within DOM/React budgets.
 *
 * Y-axis scale: 'linear' uses bin / max; 'log' uses log(1+bin) / log(1+max),
 * which is the standard "log-of-counts" view that surfaces sparse bins
 * without losing the big peaks (and handles bin=0 cleanly).
 *
 * Colour: bars use currentColor, so the caller controls hue via a Tailwind
 * text-* class on a wrapper — e.g. text-red-500 for the Red channel.
 */
export function Histogram({ bins, scale = 'linear', className }: Props) {
  const heights = useMemo(() => computeHeights(bins, scale), [bins, scale]);

  return (
    <svg
      viewBox="0 0 256 100"
      preserveAspectRatio="none"
      className={cn('block h-32 w-full', className)}
      aria-label="Гистограмма"
    >
      <rect width="256" height="100" fill="currentColor" opacity="0.04" />
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i}
          y={100 - h}
          width={1}
          height={h}
          fill="currentColor"
        />
      ))}
      <line
        x1="0"
        y1="100"
        x2="256"
        y2="100"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.4"
      />
    </svg>
  );
}

function computeHeights(bins: Uint32Array, scale: HistogramScale): number[] {
  let max = 0;
  for (let i = 0; i < bins.length; i++) {
    const v = bins[i]!;
    if (v > max) max = v;
  }
  if (max === 0) return new Array<number>(bins.length).fill(0);

  const out = new Array<number>(bins.length);
  if (scale === 'log') {
    const denom = Math.log(1 + max);
    for (let i = 0; i < bins.length; i++) {
      out[i] = (Math.log(1 + bins[i]!) / denom) * 100;
    }
  } else {
    for (let i = 0; i < bins.length; i++) {
      out[i] = (bins[i]! / max) * 100;
    }
  }
  return out;
}
