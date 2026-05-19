import { useEffect, useRef } from 'react';
import { ImageIcon } from 'lucide-react';
import { renderToCanvas } from '@/canvas/render';
import type { RasterImage } from '@/formats/types';
import { cn } from '@/lib/utils';

type Props = {
  image: RasterImage | null;
  fitToView: boolean;
};

export function CanvasView({ image, fitToView }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (image && canvasRef.current) {
      renderToCanvas(canvasRef.current, image);
    }
  }, [image]);

  return (
    <div className="flex min-h-0 items-center justify-center overflow-auto bg-muted/40 p-4">
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
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/40 p-10 text-center">
      <ImageIcon className="h-10 w-10 text-muted-foreground" />
      <p className="text-base font-medium">
        Нажмите Open, чтобы открыть изображение
      </p>
      <p className="text-sm text-muted-foreground">
        Формат определяется по сигнатуре файла, а не по расширению.
      </p>
    </div>
  );
}
