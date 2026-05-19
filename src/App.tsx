import { useCallback, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { CanvasView } from './components/CanvasView';
import { StatusBar } from './components/StatusBar';
import { useImageFile } from './hooks/useImageFile';
import type { RasterImage } from './formats/types';

export function App() {
  const [image, setImage] = useState<RasterImage | null>(null);
  const [fitToView, setFitToView] = useState(true);

  const handleLoaded = useCallback((next: RasterImage) => {
    setImage(next);
  }, []);

  const handleError = useCallback((message: string) => {
    // TODO: surface this in the UI (toast) — for now just log.
    console.error(message);
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
      <CanvasView image={image} fitToView={fitToView} />
      <StatusBar image={image} />
    </div>
  );
}
