import { useEffect, useMemo, useState } from 'react';
import { Info, Link2, Link2Off } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';
import type { RasterImage } from '@/formats/types';
import type { InterpolationMethod } from '@/transforms/resize';

type Unit = 'px' | '%';

type Props = {
  image: RasterImage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (newWidth: number, newHeight: number, method: InterpolationMethod) => void;
};

const MAX_DIMENSION = 8192;
const MAX_PERCENT = 1000;

const ALGORITHM_DESCRIPTIONS: Record<InterpolationMethod, string> = {
  nearest:
    'Копирует ближайший пиксель оригинала. Резкие границы, без сглаживания. Подходит для пиксель-арта и схем, где важна чёткость.',
  bilinear:
    'Взвешенное смешивание 4 соседних пикселей пропорционально расстоянию. Плавные переходы. Подходит для фотографий. По умолчанию.',
};

/**
 * Modal "Image Size" dialog. Resize is a one-shot destructive operation —
 * unlike Levels, a modal with backdrop is the right pattern here: the
 * preview lives in the dialog (the Mpx readout) and the user is committing
 * to a single transform.
 */
export function ResizeDialog({ image, open, onOpenChange, onApply }: Props) {
  const [unit, setUnit] = useState<Unit>('px');
  const [widthInput, setWidthInput] = useState(String(image.width));
  const [heightInput, setHeightInput] = useState(String(image.height));
  const [lockAspect, setLockAspect] = useState(true);
  const [method, setMethod] = useState<InterpolationMethod>('bilinear');

  // Fresh form state on every open and whenever the source image changes
  // (e.g., after a previous resize). Avoids stale values from the last edit.
  useEffect(() => {
    if (open) {
      setUnit('px');
      setWidthInput(String(image.width));
      setHeightInput(String(image.height));
      setLockAspect(true);
      setMethod('bilinear');
    }
  }, [open, image.width, image.height]);

  const aspect = image.width / image.height;

  const targetWidthPx = useMemo(
    () => inputToPixels(widthInput, unit, image.width),
    [widthInput, unit, image.width],
  );
  const targetHeightPx = useMemo(
    () => inputToPixels(heightInput, unit, image.height),
    [heightInput, unit, image.height],
  );

  const widthError = validateDimension(targetWidthPx);
  const heightError = validateDimension(targetHeightPx);
  const hasErrors = widthError !== null || heightError !== null;

  const beforeMpx = (image.width * image.height) / 1e6;
  const afterMpx =
    Number.isFinite(targetWidthPx) && Number.isFinite(targetHeightPx)
      ? (Math.round(targetWidthPx) * Math.round(targetHeightPx)) / 1e6
      : NaN;

  const handleWidthChange = (s: string) => {
    setWidthInput(s);
    if (!lockAspect) return;
    const v = parseFloat(s);
    if (!Number.isFinite(v) || v <= 0) return;
    if (unit === 'px') {
      setHeightInput(String(Math.max(1, Math.round(v / aspect))));
    } else {
      setHeightInput(s);
    }
  };

  const handleHeightChange = (s: string) => {
    setHeightInput(s);
    if (!lockAspect) return;
    const v = parseFloat(s);
    if (!Number.isFinite(v) || v <= 0) return;
    if (unit === 'px') {
      setWidthInput(String(Math.max(1, Math.round(v * aspect))));
    } else {
      setWidthInput(s);
    }
  };

  const handleUnitChange = (next: Unit) => {
    if (next === unit) return;
    // Convert current values so the displayed dimensions don't visually jump.
    const w = parseFloat(widthInput);
    const h = parseFloat(heightInput);
    setUnit(next);
    if (next === '%') {
      if (Number.isFinite(w) && w > 0) setWidthInput(formatPercent((w / image.width) * 100));
      if (Number.isFinite(h) && h > 0) setHeightInput(formatPercent((h / image.height) * 100));
    } else {
      if (Number.isFinite(w) && w > 0) {
        setWidthInput(String(Math.max(1, Math.round((w / 100) * image.width))));
      }
      if (Number.isFinite(h) && h > 0) {
        setHeightInput(String(Math.max(1, Math.round((h / 100) * image.height))));
      }
    }
  };

  const close = () => onOpenChange(false);

  const handleApply = () => {
    if (hasErrors) return;
    onApply(Math.round(targetWidthPx), Math.round(targetHeightPx), method);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Размер изображения</DialogTitle>
          <DialogDescription>
            Измените размер с использованием выбранного алгоритма интерполяции.
            Источник в новом размере заменит текущее изображение.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">До → После:</span>
            <span>
              <span className="text-foreground">{beforeMpx.toFixed(2)}</span>
              {' → '}
              <span className="text-foreground">
                {Number.isFinite(afterMpx) ? afterMpx.toFixed(2) : '—'}
              </span>{' '}
              Мпикс
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Label className="w-20 text-sm">Единицы</Label>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={unit}
              onChange={(event) => handleUnitChange(event.target.value as Unit)}
            >
              <option value="px">пиксели</option>
              <option value="%">проценты</option>
            </select>
          </div>

          <DimensionField
            label="Ширина"
            value={widthInput}
            onChange={handleWidthChange}
            error={widthError}
            unit={unit}
          />
          <DimensionField
            label="Высота"
            value={heightInput}
            onChange={handleHeightChange}
            error={heightError}
            unit={unit}
          />

          <button
            type="button"
            onClick={() => setLockAspect((prev) => !prev)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            aria-pressed={lockAspect}
          >
            {lockAspect ? (
              <Link2 className="h-3.5 w-3.5" />
            ) : (
              <Link2Off className="h-3.5 w-3.5" />
            )}
            <span>{lockAspect ? 'Сохранять пропорции' : 'Пропорции независимы'}</span>
          </button>

          <div className="flex items-center gap-2">
            <Label className="w-20 text-sm">Алгоритм</Label>
            <select
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={method}
              onChange={(event) => setMethod(event.target.value as InterpolationMethod)}
            >
              <option value="bilinear">Билинейная</option>
              <option value="nearest">Ближайший сосед</option>
            </select>
            <AlgorithmTooltip text={ALGORITHM_DESCRIPTIONS[method]} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={close}>
            Отмена
          </Button>
          <Button onClick={handleApply} disabled={hasErrors}>
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DimensionFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  unit: Unit;
};

function DimensionField({ label, value, onChange, error, unit }: DimensionFieldProps) {
  const min = unit === 'px' ? 1 : 0.1;
  const max = unit === 'px' ? MAX_DIMENSION : MAX_PERCENT;
  const step = unit === 'px' ? 1 : 0.1;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Label className="w-20 text-sm">{label}</Label>
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          min={min}
          max={max}
          step={step}
          className={cn(
            'h-8 flex-1 rounded-md border bg-background px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            error ? 'border-destructive' : 'border-input',
          )}
        />
        <span className="w-6 text-xs text-muted-foreground">{unit}</span>
      </div>
      {error && <p className="ml-[5.5rem] text-xs text-destructive">{error}</p>}
    </div>
  );
}

function AlgorithmTooltip({ text }: { text: string }) {
  return (
    <div className="group relative shrink-0">
      <Info className="h-4 w-4 cursor-help text-muted-foreground" />
      <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 hidden w-64 rounded-md border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md group-hover:block">
        {text}
      </div>
    </div>
  );
}

function inputToPixels(input: string, unit: Unit, sourceDim: number): number {
  const v = parseFloat(input);
  if (!Number.isFinite(v)) return NaN;
  return unit === 'px' ? v : (v / 100) * sourceDim;
}

function validateDimension(px: number): string | null {
  if (!Number.isFinite(px)) return 'Введите число';
  if (px <= 0) return 'Должно быть больше 0';
  if (px > MAX_DIMENSION) return `Не больше ${MAX_DIMENSION} px`;
  return null;
}

function formatPercent(p: number): string {
  return (Math.round(p * 10) / 10).toString();
}
