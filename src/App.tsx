import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { Toolbar } from './components/Toolbar';
import { CanvasView } from './components/CanvasView';
import { StatusBar } from './components/StatusBar';
import { ChannelsPanel } from './components/ChannelsPanel';
import { LevelsDialog } from './components/LevelsDialog';
import { ResizeDialog } from './components/ResizeDialog';
import { useImageFile } from './hooks/useImageFile';
import type { Channel, RasterImage } from './formats/types';
import { applyPipeline } from './transforms/apply';
import { DEFAULT_PIPELINE, type Pipeline } from './transforms/types';
import { applyLevels, type LevelsBag } from './transforms/levels';
import { downsampleImage } from './transforms/downsample';
import { resizeImage, type InterpolationMethod } from './transforms/resize';
import type { PickedPixel, Tool } from './tools/types';
import { srgbToLab } from './color/srgb-to-lab';
import { clampZoom, computeFitZoom } from './canvas/zoom';

/** Longest side, in pixels, for the Levels-preview working copy. */
const PREVIEW_MAX_DIMENSION = 1500;
/** Step factor for the +/- keyboard zoom shortcuts. */
const ZOOM_KEY_STEP = 1.25;

export function App() {
  const [sourceImage, setSourceImage] = useState<RasterImage | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline>(DEFAULT_PIPELINE);
  const [tool, setTool] = useState<Tool>('none');
  const [pickedPixel, setPickedPixel] = useState<PickedPixel | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [viewZoom, setViewZoom] = useState<number>(100);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);

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
    if (pipeline.levels && previewSource) {
      return applyPipeline(previewSource, pipeline);
    }
    return applyPipeline(sourceImage, pipeline);
  }, [sourceImage, previewSource, pipeline]);

  // Fit-to-view when image dimensions change (file load, destructive resize).
  // Levels Apply keeps the same dimensions and therefore the user's zoom.
  const prevDimsKeyRef = useRef<string>('');
  useEffect(() => {
    if (!sourceImage || !viewportRef.current) return;
    const key = `${sourceImage.width}x${sourceImage.height}`;
    if (prevDimsKeyRef.current === key) return;
    prevDimsKeyRef.current = key;
    const rect = viewportRef.current.getBoundingClientRect();
    setViewZoom(computeFitZoom(sourceImage, rect.width, rect.height));
  }, [sourceImage]);

  // Keyboard zoom shortcuts: + / - step, 0 fit, 1 = 100%. Skipped when an
  // input has focus so typing into the zoom number field doesn't fight us.
  useEffect(() => {
    if (!sourceImage) return;
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as Element | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setViewZoom((z) => clampZoom(Math.round(z * ZOOM_KEY_STEP)));
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        setViewZoom((z) => clampZoom(Math.round(z / ZOOM_KEY_STEP)));
      } else if (event.key === '0') {
        event.preventDefault();
        if (viewportRef.current) {
          const rect = viewportRef.current.getBoundingClientRect();
          setViewZoom(computeFitZoom(sourceImage, rect.width, rect.height));
        }
      } else if (event.key === '1') {
        event.preventDefault();
        setViewZoom(100);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sourceImage]);

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

  const handleResizeApply = useCallback(
    (newWidth: number, newHeight: number, method: InterpolationMethod) => {
      setSourceImage((prev) => (prev ? resizeImage(prev, newWidth, newHeight, method) : prev));
      // Dimensions change → previous coords and any in-flight Levels preview
      // no longer apply to the new pixels.
      setPickedPixel(null);
      setPipeline((prev) => ({ ...prev, levels: null }));
      toast.success(`Размер изменён: ${newWidth} × ${newHeight}`);
    },
    [],
  );

  const { loadFile, isLoading } = useImageFile({
    onLoaded: handleLoaded,
    onError: handleError,
  });

  return (
    <div className="grid h-screen grid-rows-[auto_1fr_auto] bg-background text-foreground">
      <Toolbar
        image={sourceImage}
        onPickFile={loadFile}
        isLoading={isLoading}
        tool={tool}
        onToggleTool={handleToggleTool}
        onOpenLevels={() => setLevelsOpen(true)}
        onOpenResize={() => setResizeOpen(true)}
      />
      <div className="flex min-h-0 flex-col lg:flex-row">
        <CanvasView
          ref={viewportRef}
          image={displayImage}
          viewZoom={viewZoom}
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
      <StatusBar
        image={sourceImage}
        pickedPixel={pickedPixel}
        viewZoom={viewZoom}
        onViewZoomChange={setViewZoom}
      />
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
      {sourceImage && (
        <ResizeDialog
          image={sourceImage}
          open={resizeOpen}
          onOpenChange={setResizeOpen}
          onApply={handleResizeApply}
        />
      )}
    </div>
  );
}
