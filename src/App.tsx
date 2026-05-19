import { useCallback, useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { Toolbar } from './components/Toolbar';
import { CanvasView } from './components/CanvasView';
import { StatusBar } from './components/StatusBar';
import { useImageFile } from './hooks/useImageFile';
import type { RasterImage } from './formats/types';
import { applyPipeline } from './transforms/apply';
import { DEFAULT_PIPELINE, type Pipeline } from './transforms/types';

export function App() {
  const [sourceImage, setSourceImage] = useState<RasterImage | null>(null);
  const [pipeline, _setPipeline] = useState<Pipeline>(DEFAULT_PIPELINE);
  const [lastError, setLastError] = useState<string | null>(null);
  const [fitToView, setFitToView] = useState(true);

  const displayImage = useMemo<RasterImage | null>(
    () => (sourceImage ? applyPipeline(sourceImage, pipeline) : null),
    [sourceImage, pipeline],
  );

  const handleLoaded = useCallback((next: RasterImage) => {
    setSourceImage(next);
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
        image={sourceImage}
        onPickFile={loadFile}
        fitToView={fitToView}
        onToggleFit={setFitToView}
        isLoading={isLoading}
      />
      <CanvasView
        image={displayImage}
        fitToView={fitToView}
        lastError={sourceImage ? null : lastError}
        onDropFile={loadFile}
      />
      <StatusBar image={sourceImage} />
      <Toaster richColors position="bottom-right" closeButton />
    </div>
  );
}
