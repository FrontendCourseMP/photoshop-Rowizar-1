import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { Toolbar } from './components/Toolbar';
import { CanvasView } from './components/CanvasView';
import { StatusBar } from './components/StatusBar';
import { ChannelsPanel } from './components/ChannelsPanel';
import { LevelsDialog } from './components/LevelsDialog';
import { useImageFile } from './hooks/useImageFile';
import type { Channel, RasterImage } from './formats/types';
import { applyPipeline } from './transforms/apply';
import { DEFAULT_PIPELINE, type Pipeline } from './transforms/types';
import { applyLevels, type LevelsBag } from './transforms/levels';
import type { PickedPixel, Tool } from './tools/types';
import { srgbToLab } from './color/srgb-to-lab';

export function App() {
  const [sourceImage, setSourceImage] = useState<RasterImage | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline>(DEFAULT_PIPELINE);
  const [tool, setTool] = useState<Tool>('none');
  const [pickedPixel, setPickedPixel] = useState<PickedPixel | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [fitToView, setFitToView] = useState(true);
  const [levelsOpen, setLevelsOpen] = useState(false);

  // rAF-throttling for the Levels preview. applyLevels on a multi-megapixel
  // image can cost ~10ms, and pointer events fire much faster than the
  // browser repaints — coalesce all of them into one update per frame.
  const pendingLevelsRef = useRef<LevelsBag | null>(null);
  const hasPendingLevelsRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const displayImage = useMemo<RasterImage | null>(
    () => (sourceImage ? applyPipeline(sourceImage, pipeline) : null),
    [sourceImage, pipeline],
  );

  const handleLoaded = useCallback((next: RasterImage) => {
    setSourceImage(next);
    setPickedPixel(null);
    setLastError(null);
    toast.success(`Загружено: ${next.width} × ${next.height} (${next.meta.format.toUpperCase()})`);
  }, []);

  const handleError = useCallback((message: string) => {
    setLastError(message);
    toast.error(message);
  }, []);

  const toggleChannel = useCallback((ch: Channel) => {
    setPipeline((prev) => ({
      ...prev,
      channelMask: { ...prev.channelMask, [ch]: !prev.channelMask[ch] },
    }));
  }, []);

  const handleToggleTool = useCallback((next: Tool) => {
    setTool(next);
    if (next === 'none') setPickedPixel(null);
  }, []);

  const handlePickPixel = useCallback(
    (x: number, y: number) => {
      if (!sourceImage) return;
      const o = (y * sourceImage.width + x) * 4;
      const r = sourceImage.pixels[o]!;
      const g = sourceImage.pixels[o + 1]!;
      const b = sourceImage.pixels[o + 2]!;
      const a = sourceImage.pixels[o + 3]!;
      setPickedPixel({ x, y, r, g, b, a, lab: srgbToLab(r, g, b) });
    },
    [sourceImage],
  );

  const handleLevelsPreview = useCallback((bag: LevelsBag | null) => {
    pendingLevelsRef.current = bag;
    hasPendingLevelsRef.current = true;
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (!hasPendingLevelsRef.current) return;
      hasPendingLevelsRef.current = false;
      const next = pendingLevelsRef.current;
      setPipeline((prev) => ({ ...prev, levels: next }));
    });
  }, []);

  const handleLevelsApply = useCallback((bag: LevelsBag) => {
    setSourceImage((prev) => (prev ? applyLevels(prev, bag) : prev));
    setPipeline((prev) => ({ ...prev, levels: null }));
    setPickedPixel(null);
    toast.success('Уровни применены');
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
        tool={tool}
        onToggleTool={handleToggleTool}
        onOpenLevels={() => setLevelsOpen(true)}
      />
      <div className="flex min-h-0 flex-col lg:flex-row">
        <CanvasView
          image={displayImage}
          fitToView={fitToView}
          lastError={sourceImage ? null : lastError}
          onDropFile={loadFile}
          tool={tool}
          onPickPixel={handlePickPixel}
          className="flex-1"
        />
        <ChannelsPanel
          image={sourceImage}
          channelMask={pipeline.channelMask}
          onToggle={toggleChannel}
        />
      </div>
      <StatusBar image={sourceImage} pickedPixel={pickedPixel} />
      <Toaster richColors position="bottom-right" closeButton />
      {sourceImage && (
        <LevelsDialog
          image={sourceImage}
          open={levelsOpen}
          onOpenChange={setLevelsOpen}
          onPreviewBag={handleLevelsPreview}
          onApply={handleLevelsApply}
        />
      )}
    </div>
  );
}
