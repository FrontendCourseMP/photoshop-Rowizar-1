import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { KernelEditor } from './KernelEditor';
import { cn } from '@/lib/utils';
import type { Channel, RasterImage } from '@/formats/types';
import type { ConvolutionParams, EdgeMode, Kernel3x3 } from '@/transforms/convolution';
import { IDENTITY_KERNEL, isIdentityKernel } from '@/transforms/convolution';

type Props = {
  image: RasterImage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Live-preview hook: parent updates pipeline.convolution to render this
   *  state, or clears it (null) when preview is off / panel is closing /
   *  the kernel is identity / no channel is selected. */
  onPreview: (params: ConvolutionParams | null) => void;
  /** Destructive apply: parent bakes this convolution into sourceImage. */
  onApply: (params: ConvolutionParams) => void;
  /** While true, the dialog displays the progress bar and disables most
   *  controls. The Apply pipeline owns this flag. */
  applying?: boolean;
  /** Fraction 0..1, only meaningful while applying. */
  progress?: number;
};

const PANEL_WIDTH = 460;
const PANEL_MARGIN = 16;

const EDGE_MODES: { value: EdgeMode; label: string; description: string }[] = [
  {
    value: 'clamp',
    label: 'Копирование',
    description: 'За границей берётся ближайший пиксель изображения. Стандартный выбор для большинства фильтров.',
  },
  {
    value: 'black',
    label: 'Чёрный',
    description: 'За границей считается чёрный (0). Заметная тёмная рамка на размытии светлых изображений.',
  },
  {
    value: 'white',
    label: 'Белый',
    description: 'За границей считается белый (255). Полезно для сканированных документов.',
  },
];

const CHANNEL_LABELS: Record<Channel, string> = {
  R: 'Красный',
  G: 'Зелёный',
  B: 'Синий',
  A: 'Альфа',
  Gray: 'Серый',
};

export function ConvolutionDialog({
  image,
  open,
  onOpenChange,
  onPreview,
  onApply,
  applying = false,
  progress,
}: Props) {
  const availableChannels = useMemo(() => image.meta.channels, [image.meta.channels]);
  const showChannelSelector = availableChannels.length > 1;

  const [kernel, setKernel] = useState<Kernel3x3>(IDENTITY_KERNEL);
  const [channels, setChannels] = useState<Set<Channel>>(() => defaultChannelsFor(image));
  const [edgeMode, setEdgeMode] = useState<EdgeMode>('clamp');
  const [previewOn, setPreviewOn] = useState(true);

  // Drag state for the floating panel — position persists across open/close
  // so the second open finds the panel where the user left it.
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: PANEL_MARGIN, y: 64 };
    return {
      x: Math.max(PANEL_MARGIN, window.innerWidth - PANEL_WIDTH - PANEL_MARGIN),
      y: 64,
    };
  });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // Fresh content state when the panel opens.
  useEffect(() => {
    if (open) {
      setKernel(IDENTITY_KERNEL);
      setChannels(defaultChannelsFor(image));
      setEdgeMode('clamp');
      setPreviewOn(true);
    }
    // image is intentionally excluded — opening shouldn't refire when image
    // changes, only when `open` flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // After Apply replaces sourceImage, reset kernel back to identity so the
  // next pass starts from the freshly baked picture. Channels and edge mode
  // stay — the user's tool prefs persist for stacking.
  useEffect(() => {
    setKernel(IDENTITY_KERNEL);
  }, [image]);

  // Drop channels that no longer exist on the new image (e.g. RGBA → RGB).
  useEffect(() => {
    setChannels((prev) => {
      const next = new Set<Channel>();
      for (const c of prev) {
        if (availableChannels.includes(c)) next.add(c);
      }
      return next;
    });
  }, [availableChannels]);

  // Preview push to parent. Identity kernel and empty channel set both mean
  // "no-op convolution" — clear the slot so the canvas stays on full-res
  // source instead of routing through the preview pipeline.
  useEffect(() => {
    if (!open || !previewOn || isIdentityKernel(kernel) || channels.size === 0) {
      onPreview(null);
    } else {
      onPreview({ kernel, channels, edgeMode });
    }
  }, [open, previewOn, kernel, channels, edgeMode, onPreview]);

  // ESC closes the panel, unless Apply is mid-flight.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applying) handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, applying]);

  const handleClose = () => {
    onPreview(null);
    onOpenChange(false);
  };

  const handleReset = () => {
    setKernel(IDENTITY_KERNEL);
    setChannels(defaultChannelsFor(image));
    setEdgeMode('clamp');
  };

  const handleApply = () => {
    if (isIdentityKernel(kernel) || channels.size === 0 || applying) return;
    onApply({ kernel, channels, edgeMode });
  };

  const onHeaderDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos.x,
      baseY: pos.y,
    };
  };
  const onHeaderMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: clamp(dragRef.current.baseX + dx, -PANEL_WIDTH + 80, window.innerWidth - 80),
      y: clamp(dragRef.current.baseY + dy, 0, window.innerHeight - 60),
    });
  };
  const onHeaderUp = () => {
    dragRef.current = null;
  };

  const toggleChannel = (channel: Channel, checked: boolean) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (checked) next.add(channel);
      else next.delete(channel);
      return next;
    });
  };

  if (!open) return null;

  const applyDisabled = applying || isIdentityKernel(kernel) || channels.size === 0;

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
      aria-label="Фильтр (свёртка)"
    >
      <div
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
        onPointerCancel={onHeaderUp}
        className="flex cursor-move select-none touch-none items-center justify-between rounded-t-lg border-b border-border bg-muted/40 px-4 py-2"
      >
        <div className="flex flex-col">
          <span className="font-semibold leading-tight">Фильтр (свёртка)</span>
          <span className="text-xs text-muted-foreground">Перетащите заголовок, чтобы передвинуть</span>
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleClose}
          disabled={applying}
          className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <KernelEditor kernel={kernel} onChange={setKernel} />

        {showChannelSelector && (
          <div className="space-y-1.5">
            <Label className="text-sm">Каналы</Label>
            <div className="flex flex-wrap gap-3" title="Отключённые каналы остаются без изменений">
              {availableChannels.map((channel) => (
                <label
                  key={channel}
                  className="flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <Checkbox
                    checked={channels.has(channel)}
                    onCheckedChange={(c) => toggleChannel(channel, c === true)}
                    disabled={applying}
                  />
                  <span>{CHANNEL_LABELS[channel]}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-sm">Края</Label>
          <div className="flex items-center gap-0.5 rounded-md border bg-muted/30 p-0.5 text-xs">
            {EDGE_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setEdgeMode(mode.value)}
                title={mode.description}
                disabled={applying}
                className={cn(
                  'flex-1 rounded px-2 py-1 transition-colors disabled:opacity-50',
                  edgeMode === mode.value
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="filter-preview"
            checked={previewOn}
            onCheckedChange={(c) => setPreviewOn(c === true)}
            disabled={applying}
          />
          <Label htmlFor="filter-preview" className="text-sm">
            Предпросмотр
          </Label>
        </div>

        {applying && progress != null && (
          <div className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-100"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-right text-xs text-muted-foreground">
              {Math.round(progress * 100)}%
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 rounded-b-lg border-t border-border bg-muted/20 px-4 py-3">
        <Button variant="outline" onClick={handleReset} disabled={applying}>
          Сброс
        </Button>
        <Button variant="outline" onClick={handleClose} disabled={applying}>
          Отмена
        </Button>
        <Button onClick={handleApply} disabled={applyDisabled}>
          {applying ? 'Применяется...' : 'Применить'}
        </Button>
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * R/G/B (or Gray) on by default; A off. Convolving alpha rarely matches
 * user intent — it muddies opacity edges — so we leave it unchecked unless
 * explicitly enabled.
 */
function defaultChannelsFor(image: RasterImage): Set<Channel> {
  const result = new Set<Channel>();
  for (const c of image.meta.channels) {
    if (c !== 'A') result.add(c);
  }
  return result;
}
