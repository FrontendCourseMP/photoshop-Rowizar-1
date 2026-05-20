import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Histogram, type HistogramScale } from './Histogram';
import { LevelsSlider } from './LevelsSlider';
import { cn } from '@/lib/utils';
import { computeHistogram, type HistogramSource } from '@/transforms/histogram';
import {
  IDENTITY_LEVELS_BAG,
  isIdentityBag,
  type LevelsBag,
  type LevelsParams,
} from '@/transforms/levels';
import type { RasterImage } from '@/formats/types';

type ChannelTab = keyof LevelsBag;

type Props = {
  image: RasterImage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Live-preview hook: parent updates pipeline.levels to render this bag,
   *  or clears it (null) when preview is off / dialog is closing. */
  onPreviewBag: (bag: LevelsBag | null) => void;
  /** Destructive apply: parent bakes this bag into sourceImage. */
  onApply: (bag: LevelsBag) => void;
};

const TAB_LABELS: Record<ChannelTab, string> = {
  master: 'Master (RGB)',
  R: 'Красный',
  G: 'Зелёный',
  B: 'Синий',
  A: 'Альфа',
  Gray: 'Серый',
};

const PANEL_WIDTH = 460;
const VIEWPORT_MARGIN = 16;

function initialPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  return {
    x: Math.max(VIEWPORT_MARGIN, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN),
    y: 64,
  };
}

/**
 * Non-modal floating panel for the Levels tool. Drag by the header to move
 * it out of the way — the live preview is useless if the dialog covers the
 * picture being adjusted. There is no backdrop and no focus trap; clicks on
 * the canvas still work while the panel is open. ESC and the × button close.
 */
export function LevelsDialog({ image, open, onOpenChange, onPreviewBag, onApply }: Props) {
  const tabs = useMemo(() => availableTabs(image), [image]);
  const [tab, setTab] = useState<ChannelTab>(tabs[0] ?? 'master');
  const [bag, setBag] = useState<LevelsBag>(IDENTITY_LEVELS_BAG);
  const [scale, setScale] = useState<HistogramScale>('linear');
  const [previewOn, setPreviewOn] = useState(true);
  const [pos, setPos] = useState<{ x: number; y: number }>(initialPosition);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  // Fresh content state each time the dialog opens. Position is left alone:
  // if the user moved the panel, the next open finds it where they left it.
  useEffect(() => {
    if (open) {
      setBag(IDENTITY_LEVELS_BAG);
      setTab(tabs[0] ?? 'master');
      setScale('linear');
      setPreviewOn(true);
    }
  }, [open, tabs]);

  // After Apply replaces sourceImage while the panel stays open, reset the
  // bag to identity so the next pass starts from the freshly baked picture.
  // Tab/scale/preview stay as-is — the user keeps their working context.
  useEffect(() => {
    setBag(IDENTITY_LEVELS_BAG);
  }, [image]);

  // If the new image lost a channel the user was editing (e.g. switched
  // from RGBA to RGB), drop down to a valid tab.
  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0] ?? 'master');
  }, [tabs, tab]);

  // Push current preview to the parent only when the bag actually changes
  // pixels. An identity bag pretends preview is off so the canvas stays on
  // the full-resolution sourceImage instead of the downsampled preview copy.
  useEffect(() => {
    if (open && previewOn && !isIdentityBag(bag)) onPreviewBag(bag);
    else onPreviewBag(null);
  }, [open, previewOn, bag, onPreviewBag]);

  // ESC closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const histogramSource = histogramSourceFor(tab);
  const bins = useMemo(
    () => computeHistogram(image, histogramSource),
    [image, histogramSource],
  );

  const handleParamChange = (next: LevelsParams) => {
    setBag((prev) => ({ ...prev, [tab]: next }));
  };

  const closePanel = () => {
    onPreviewBag(null);
    onOpenChange(false);
  };

  const handleReset = () => setBag(IDENTITY_LEVELS_BAG);
  // Apply bakes the LUT into sourceImage but keeps the panel open so the
  // user can layer another pass without re-opening it. The image-change
  // effect above resets the bag to identity for the next iteration.
  const handleApply = () => {
    onApply(bag);
  };

  const onHeaderPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: pos.x,
      baseY: pos.y,
    };
  };

  const onHeaderPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setPos({
      x: clamp(drag.baseX + dx, -PANEL_WIDTH + 80, window.innerWidth - 80),
      y: clamp(drag.baseY + dy, 0, window.innerHeight - 60),
    });
  };

  const onHeaderPointerUp = () => {
    dragRef.current = null;
  };

  if (!open) return null;

  return (
    <div
      className="fixed z-50 flex flex-col rounded-lg border border-border bg-card shadow-2xl"
      style={{
        left: pos.x,
        top: pos.y,
        width: PANEL_WIDTH,
        maxWidth: 'calc(100vw - 2rem)',
      }}
      role="dialog"
      aria-modal="false"
      aria-label="Уровни"
    >
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
        className="flex cursor-move touch-none select-none items-center justify-between rounded-t-lg border-b border-border bg-muted/40 px-4 py-2"
      >
        <div className="flex flex-col">
          <span className="font-semibold leading-tight">Уровни</span>
          <span className="text-xs text-muted-foreground">
            Перетащите за заголовок, чтобы передвинуть
          </span>
        </div>
        <button
          type="button"
          onClick={closePanel}
          onPointerDown={(event) => event.stopPropagation()}
          className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-sm">Канал</Label>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={tab}
            onChange={(event) => setTab(event.target.value as ChannelTab)}
          >
            {tabs.map((t) => (
              <option key={t} value={t}>
                {TAB_LABELS[t]}
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-0.5 rounded-md border bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setScale('linear')}
              className={cn(
                'rounded px-2 py-0.5',
                scale === 'linear' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              Линейная
            </button>
            <button
              type="button"
              onClick={() => setScale('log')}
              className={cn(
                'rounded px-2 py-0.5',
                scale === 'log' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              Лог.
            </button>
          </div>
        </div>

        <div className={cn('rounded-md border bg-card p-1', tabTextColor(tab))}>
          <Histogram bins={bins} scale={scale} />
        </div>

        <LevelsSlider value={bag[tab]} onChange={handleParamChange} />

        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="levels-preview"
            checked={previewOn}
            onCheckedChange={(c) => setPreviewOn(c === true)}
          />
          <Label htmlFor="levels-preview" className="text-sm">
            Предпросмотр
          </Label>
        </div>
      </div>

      <div className="flex justify-end gap-2 rounded-b-lg border-t border-border bg-muted/20 px-4 py-3">
        <Button variant="outline" onClick={handleReset}>
          Сброс
        </Button>
        <Button variant="outline" onClick={closePanel}>
          Отмена
        </Button>
        <Button onClick={handleApply}>Применить</Button>
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function availableTabs(image: RasterImage): ChannelTab[] {
  const channels = image.meta.channels;
  const isGray = channels.includes('Gray');
  const tabs: ChannelTab[] = [];
  if (!isGray) tabs.push('master');
  if (channels.includes('Gray')) tabs.push('Gray');
  if (channels.includes('R')) tabs.push('R');
  if (channels.includes('G')) tabs.push('G');
  if (channels.includes('B')) tabs.push('B');
  if (channels.includes('A')) tabs.push('A');
  return tabs;
}

function histogramSourceFor(tab: ChannelTab): HistogramSource {
  if (tab === 'master' || tab === 'Gray') return 'lightness';
  return tab;
}

function tabTextColor(tab: ChannelTab): string {
  switch (tab) {
    case 'R':
      return 'text-red-500';
    case 'G':
      return 'text-green-500';
    case 'B':
      return 'text-blue-500';
    default:
      return 'text-muted-foreground';
  }
}
