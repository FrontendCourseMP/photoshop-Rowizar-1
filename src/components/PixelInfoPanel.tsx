import type { PickedPixel } from '@/tools/types';

type Props = {
  pixel: PickedPixel;
};

export function PixelInfoPanel({ pixel }: Props) {
  const { x, y, r, g, b, a, lab } = pixel;
  return (
    <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap text-xs text-muted-foreground">
      <span
        className="inline-block h-4 w-4 shrink-0 rounded border border-border"
        style={{ background: `rgba(${r}, ${g}, ${b}, ${a / 255})` }}
        aria-hidden
      />
      <span>
        <span className="text-foreground">{x}</span>,{' '}
        <span className="text-foreground">{y}</span> px
      </span>
      <span>·</span>
      <span>
        R <span className="text-foreground">{r}</span>{' '}
        G <span className="text-foreground">{g}</span>{' '}
        B <span className="text-foreground">{b}</span>
        {a !== 255 && (
          <>
            {' '}
            A <span className="text-foreground">{a}</span>
          </>
        )}
      </span>
      <span>·</span>
      <span>
        L* <span className="text-foreground">{lab.L.toFixed(1)}</span>{' '}
        a* <span className="text-foreground">{lab.a.toFixed(1)}</span>{' '}
        b* <span className="text-foreground">{lab.b.toFixed(1)}</span>
      </span>
    </div>
  );
}
