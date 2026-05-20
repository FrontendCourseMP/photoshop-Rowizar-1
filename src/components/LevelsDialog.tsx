import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Histogram, type HistogramScale } from './Histogram';
import { LevelsSlider } from './LevelsSlider';
import { cn } from '@/lib/utils';
import { computeHistogram, type HistogramSource } from '@/transforms/histogram';
import {
  IDENTITY_LEVELS_BAG,
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

export function LevelsDialog({ image, open, onOpenChange, onPreviewBag, onApply }: Props) {
  const tabs = useMemo(() => availableTabs(image), [image]);
  const [tab, setTab] = useState<ChannelTab>(tabs[0] ?? 'master');
  const [bag, setBag] = useState<LevelsBag>(IDENTITY_LEVELS_BAG);
  const [scale, setScale] = useState<HistogramScale>('linear');
  const [previewOn, setPreviewOn] = useState(true);

  // Fresh state every time the dialog opens.
  useEffect(() => {
    if (open) {
      setBag(IDENTITY_LEVELS_BAG);
      setTab(tabs[0] ?? 'master');
      setScale('linear');
      setPreviewOn(true);
    }
  }, [open, tabs]);

  // Push current preview state to the parent.
  useEffect(() => {
    if (open && previewOn) onPreviewBag(bag);
    else onPreviewBag(null);
  }, [open, previewOn, bag, onPreviewBag]);

  const histogramSource = histogramSourceFor(tab);
  const bins = useMemo(
    () => computeHistogram(image, histogramSource),
    [image, histogramSource],
  );

  const handleParamChange = (next: LevelsParams) => {
    setBag((prev) => ({ ...prev, [tab]: next }));
  };

  const close = () => {
    onPreviewBag(null);
    onOpenChange(false);
  };

  const handleReset = () => setBag(IDENTITY_LEVELS_BAG);
  const handleApply = () => {
    onApply(bag);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Уровни</DialogTitle>
          <DialogDescription>
            Перераспределите тоновый диапазон с помощью точек чёрного, белого и
            средних тонов.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-sm">Канал</Label>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={tab}
              onChange={(e) => setTab(e.target.value as ChannelTab)}
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

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleReset}>
            Сброс
          </Button>
          <Button variant="outline" onClick={close}>
            Отмена
          </Button>
          <Button onClick={handleApply}>Применить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
