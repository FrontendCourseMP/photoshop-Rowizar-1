import { useCallback, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { Toolbar } from './components/Toolbar';
import { CanvasView } from './components/CanvasView';
import { StatusBar } from './components/StatusBar';
import { useImageFile } from './hooks/useImageFile';
import type { RasterImage } from './formats/types';

export function App() {
  const [image, setImage] = useState<RasterImage | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [fitToView, setFitToView] = useState(true);

  const handleLoaded = useCallback((next: RasterImage) => {
    setImage(next);
    setLastError(null);
    toast.success(`Загружено: ${next.width} × ${next.height} (${next.meta.format.toUpperCase()})`);
  }, []);

  const handleError = useCallback((message: string) => {
    setLastError(message);
    toast.error(message);
  }, []);

  const { loadFile, isLoading } = useImageFile({
    onLoaded: handleLoaded,
    onError: handleError,
  });

  return (
    <div className="grid h-screen grid-rows-[auto_1fr_auto] bg-background text-foreground">
      <Toolbar
        image={image}
        onPickFile={loadFile}
        fitToView={fitToView}
        onToggleFit={setFitToView}
        isLoading={isLoading}
      />
      <CanvasView
        image={image}
        fitToView={fitToView}
        lastError={image ? null : lastError}
        onDropFile={loadFile}
      />
      <StatusBar image={image} />
      <Toaster richColors position="bottom-right" closeButton />
    </div>
  );
}
