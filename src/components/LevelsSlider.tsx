import { useRef, useState } from 'react';
import type { LevelsParams } from '@/transforms/levels';
import { cn } from '@/lib/utils';

type Props = {
  value: LevelsParams;
  onChange: (next: LevelsParams) => void;
  className?: string;
};

type DraggingThumb = 'black' | 'gamma' | 'white';

const GAMMA_MIN = 0.1;
const GAMMA_MAX = 9.9;

/**
 * Three-thumb Levels slider (black point, gamma, white point) over a
 * black→white gradient. Drag uses pointer events with setPointerCapture so
 * it survives the cursor leaving the track and works for touch too.
 *
 * Gamma <-> thumb position is the Photoshop convention:
 *   relPos = (gammaX - black) / (white - black) ∈ (0, 1)
 *   gamma  = log(relPos) / log(0.5)
 * Centre (relPos=0.5) gives gamma=1; pulling toward the black thumb gives
 * gamma>1 (midtones lifted), pulling toward white gives gamma<1 (darkened).
 *
 * Constraints (enforced at drag time, not just clamped at render):
 *   black < white  — black thumb can't pass white-1 and vice versa
 *   gamma thumb stays strictly between black+1 and white-1
 */
export function LevelsSlider({ value, onChange, className }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DraggingThumb | null>(null);

  const pointerToValue = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const t = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(255, Math.round(t * 255)));
  };

  const startDrag = (which: DraggingThumb) => (event: React.PointerEvent) => {
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    setDragging(which);
  };

  const handleMove = (event: React.PointerEvent) => {
    if (!dragging) return;
    const v = pointerToValue(event.clientX);

    if (dragging === 'black') {
      onChange({ ...value, black: Math.min(v, value.white - 1) });
    } else if (dragging === 'white') {
      onChange({ ...value, white: Math.max(v, value.black + 1) });
    } else {
      const clamped = Math.max(value.black + 1, Math.min(value.white - 1, v));
      const span = Math.max(1, value.white - value.black);
      const relPos = Math.max(0.001, Math.min(0.999, (clamped - value.black) / span));
      const raw = Math.log(relPos) / Math.log(0.5);
      const gamma = Math.max(GAMMA_MIN, Math.min(GAMMA_MAX, Math.round(raw * 100) / 100));
      onChange({ ...value, gamma });
    }
  };

  const stopDrag = () => setDragging(null);

  const blackPct = (value.black / 255) * 100;
  const whitePct = (value.white / 255) * 100;
  const gammaRelPos = Math.pow(0.5, value.gamma);
  const gammaX = value.black + (value.white - value.black) * gammaRelPos;
  const gammaPct = (gammaX / 255) * 100;

  return (
    <div
      className={cn('w-full select-none', className)}
      onPointerMove={handleMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <div
        ref={trackRef}
        className="h-3 w-full rounded-sm border border-border bg-gradient-to-r from-black to-white"
      />
      <div className="relative mt-1 h-3">
        <Thumb kind="black" position={blackPct} onPointerDown={startDrag('black')} />
        <Thumb kind="gamma" position={gammaPct} onPointerDown={startDrag('gamma')} />
        <Thumb kind="white" position={whitePct} onPointerDown={startDrag('white')} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>
          Чёрная: <span className="font-medium text-foreground">{value.black}</span>
        </span>
        <span>
          Гамма: <span className="font-medium text-foreground">{value.gamma.toFixed(2)}</span>
        </span>
        <span>
          Белая: <span className="font-medium text-foreground">{value.white}</span>
        </span>
      </div>
    </div>
  );
}

type ThumbProps = {
  kind: DraggingThumb;
  position: number;
  onPointerDown: (event: React.PointerEvent) => void;
};

function Thumb({ kind, position, onPointerDown }: ThumbProps) {
  const labels = {
    black: 'Чёрная точка',
    gamma: 'Гамма',
    white: 'Белая точка',
  } as const;
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      aria-label={labels[kind]}
      className="absolute top-0 h-3 w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ left: `${position}%` }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" className="block">
        <polygon points="6,0 0,12 12,12" className={fillClass(kind)} strokeWidth="1" />
      </svg>
    </button>
  );
}

function fillClass(kind: DraggingThumb): string {
  switch (kind) {
    case 'black':
      return 'fill-foreground';
    case 'gamma':
      return 'fill-muted-foreground';
    case 'white':
      return 'fill-background stroke-foreground';
  }
}
