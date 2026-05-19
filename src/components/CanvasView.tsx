import { useEffect, useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { renderToCanvas } from '@/canvas/render';
import type { RasterImage } from '@/formats/types';
import { cn } from '@/lib/utils';

type Props = {
  image: RasterImage | null;
  fitToView: boolean;
  lastError: string | null;
  onDropFile: (file: File) => void;
  className?: string;
};

export function CanvasView({ image, fitToView, lastError, onDropFile, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setDragging] = useState(false);

  useEffect(() => {
    if (image && canvasRef.current) {
      renderToCanvas(canvasRef.current, image);
    }
  }, [image]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDragging) setDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onDropFile(file);
  };

  return (
    <div
      className={cn(
        'relative flex min-h-0 items-center justify-center overflow-auto bg-muted/40 p-4 transition-colors',
        isDragging && 'bg-primary/10 ring-2 ring-inset ring-primary',
        className,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {image ? (
        <canvas
          ref={canvasRef}
          className={cn(
            'border border-border bg-white shadow-sm',
            fitToView
              ? 'max-h-full max-w-full object-contain'
              : 'h-auto w-auto max-w-none',
          )}
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <EmptyState lastError={lastError} isDragging={isDragging} />
      )}

      {isDragging && image && (
        <div className="pointer-events-none absolute inset-4 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/60 bg-background/70 text-lg font-medium">
          Отпустите файл, чтобы загрузить
        </div>
      )}
    </div>
  );
}

function EmptyState({ lastError, isDragging }: { lastError: string | null; isDragging: boolean }) {
  return (
    <div
      className={cn(
        'flex max-w-md flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
        isDragging ? 'border-primary bg-primary/5' : 'border-border bg-card/40',
      )}
    >
      <ImageIcon className="h-10 w-10 text-muted-foreground" />
      <p className="text-base font-medium">
        Перетащите PNG / JPG / GB7 или нажмите Open
      </p>
      <p className="text-sm text-muted-foreground">
        Формат определяется по сигнатуре файла, а не по расширению.
      </p>
      {lastError && (
        <p className="mt-2 text-sm text-destructive">
          Последняя ошибка: {lastError}
        </p>
      )}
    </div>
  );
}
