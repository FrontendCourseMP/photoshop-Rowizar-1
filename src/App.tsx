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
import { downsampleImage } from './transforms/downsample';
import type { PickedPixel, Tool } from './tools/types';
import { srgbToLab } from './color/srgb-to-lab';

/** Longest side, in pixels, for the Levels-preview working copy. */
const PREVIEW_MAX_DIMENSION = 1500;

export function App() {
  const [sourceImage, setSourceImage] = useState<RasterImage | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline>(DEFAULT_PIPELINE);
  const [tool, setTool] = useState<Tool>('none');
  const [pickedPixel, setPickedPixel] = useState<PickedPixel | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [fitToView, setFitToView] = useState(true);
  const [levelsOpen, setLevelsOpen] = useState(false);

  // rAF coalescing for Levels preview. Pointer events fire much faster than
  // the browser repaints — collapse all of them into one update per frame.
  const pendingLevelsRef = useRef<LevelsBag | null>(null);
  const hasPendingLevelsRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Downsampled working copy for the live preview. Computed once per file
  // load; falls through to identity when the source is already small.
  const previewSource = useMemo<RasterImage | null>(() => {
    if (!sourceImage) return null;
    return downsampleImage(sourceImage, PREVIEW_MAX_DIMENSION);
  }, [sourceImage]);

  const displayImage = useMemo<RasterImage | null>(() => {
    if (!sourceImage) return null;
    // Route the levels preview through the downsampled copy so slider drag
    // stays smooth on multi-megapixel files. Channel mask alone is cheap and
    // always runs on the full-res source.
    if (pipeline.levels && previewSource) {
      return applyPipeline(previewSource, pipeline);
    }
    return applyPipeline(sourceImage, pipeline);
  }, [sourceImage, previewSource, pipeline]);

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

  // Click coords arrive in displayImage pixel space. When the preview is
  // routed through a downsampled copy, scale them back to source space so
  // the eyedropper reads the correct pixel from sourceImage.
  const handlePickPixel = useCallback(
    (displayX: number, displayY: number) => {
      if (!sourceImage || !displayImage) return;
      const sx = sourceImage.width / displayImage.width;
      const sy = sourceImage.height / displayImage.height;
      const x = Math.min(sourceImage.width - 1, Math.floor(displayX * sx));
      const y = Math.min(sourceImage.height - 1, Math.floor(displayY * sy));
      const o = (y * sourceImage.width + x) * 4;
      const r = sourceImage.pixels[o]!;
      const g = sourceImage.pixels[o + 1]!;
      const b = sourceImage.pixels[o + 2]!;
      const a = sourceImage.pixels[o + 3]!;
      setPickedPixel({ x, y, r, g, b, a, lab: srgbToLab(r, g, b) });
    },
    [sourceImage, displayImage],
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
