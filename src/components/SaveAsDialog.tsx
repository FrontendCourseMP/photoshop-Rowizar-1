import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { cn } from '@/lib/utils';
import { encodeBrowser } from '@/formats/browser/encode';
import { encodeGB7 } from '@/formats/gb7/encode';
import type { RasterImage, SourceFormat } from '@/formats/types';

type Props = {
  image: RasterImage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FORMATS: { value: SourceFormat; label: string; ext: string }[] = [
  { value: 'png', label: 'PNG', ext: 'png' },
  { value: 'jpeg', label: 'JPEG', ext: 'jpg' },
  { value: 'gb7', label: 'GB7', ext: 'gb7' },
];

export function SaveAsDialog({ image, open, onOpenChange }: Props) {
  const [format, setFormat] = useState<SourceFormat>('png');
  const [quality, setQuality] = useState(0.92);
  const [includeMask, setIncludeMask] = useState(image.meta.hasMask ?? false);
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      let blob: Blob;
      if (format === 'gb7') {
        const buffer = encodeGB7(image, { includeMask });
        blob = new Blob([buffer], { type: 'application/octet-stream' });
      } else {
        blob = await encodeBrowser(image, format, format === 'jpeg' ? quality : undefined);
      }
      downloadBlob(blob, `image.${FORMATS.find((f) => f.value === format)!.ext}`);
      onOpenChange(false);
      toast.success(`Сохранено как ${format.toUpperCase()}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Ошибка сохранения: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Сохранить как</DialogTitle>
          <DialogDescription>
            Выберите формат файла. Изображение будет загружено в браузер.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div>
            <Label className="mb-2 block">Формат</Label>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <Button
                  key={f.value}
                  type="button"
                  variant={format === f.value ? 'default' : 'outline'}
                  className={cn('w-full')}
                  onClick={() => setFormat(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {format === 'jpeg' && (
            <div>
              <Label className="mb-2 flex justify-between">
                <span>Качество JPEG</span>
                <span className="text-muted-foreground">{Math.round(quality * 100)}%</span>
              </Label>
              <Slider
                value={[quality]}
                onValueChange={(values) => values[0] !== undefined && setQuality(values[0])}
                min={0}
                max={1}
                step={0.01}
              />
            </div>
          )}

          {format === 'gb7' && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-mask"
                checked={includeMask}
                onCheckedChange={(value) => setIncludeMask(value === true)}
              />
              <Label htmlFor="include-mask">Сохранить маску (1-битная прозрачность)</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
