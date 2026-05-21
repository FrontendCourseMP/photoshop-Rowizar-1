import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { Toolbar } from './components/Toolbar';
import { CanvasView } from './components/CanvasView';
import { StatusBar } from './components/StatusBar';
import { ChannelsPanel } from './components/ChannelsPanel';
import { LevelsDialog } from './components/LevelsDialog';
import { ResizeDialog } from './components/ResizeDialog';
import { ConvolutionDialog } from './components/ConvolutionDialog';
import { useImageFile } from './hooks/useImageFile';
import type { Channel, RasterImage } from './formats/types';
import { applyPipeline } from './transforms/apply';
import { DEFAULT_PIPELINE, type Pipeline } from './transforms/types';
import { applyLevels, type LevelsBag } from './transforms/levels';
import { downsampleImage } from './transforms/downsample';
import { resizeImage, type InterpolationMethod } from './transforms/resize';
import type { ConvolutionParams } from './transforms/convolution';
import {
  applyConvolutionAsync,
  ConvolutionAbortError,
} from './transforms/convolution-async';
import type { PickedPixel, Tool } from './tools/types';
import { srgbToLab } from './color/srgb-to-lab';
import { clampZoom, computeFitZoom } from './canvas/zoom';

/** Longest side, in pixels, for the live-preview working copy. */
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterApplying, setFilterApplying] = useState(false);
  const [filterProgress, setFilterProgress] = useState(0);

  const viewportRef = useRef<HTMLDivElement | null>(null);

  // rAF coalescing for Levels preview. Pointer events fire much faster than
  // the browser repaints — collapse all of them into one update per frame.
  const pendingLevelsRef = useRef<LevelsBag | null>(null);
  const hasPendingLevelsRef = useRef(false);
  const levelsRafRef = useRef<number | null>(null);

  // Same idea for Convolution: kernel edits and channel toggles can fire many
  // times per frame, but the actual convolution runs once per repaint.
  const pendingConvolutionRef = useRef<ConvolutionParams | null>(null);
  const hasPendingConvolutionRef = useRef(false);
  const convolutionRafRef = useRef<number | null>(null);

  // AbortController for the in-flight async Apply. Aborted on a new file load
  // or when the user starts another Apply on top of one already running.
  const applyAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (levelsRafRef.current !== null) cancelAnimationFrame(levelsRafRef.current);
      if (convolutionRafRef.current !== null) cancelAnimationFrame(convolutionRafRef.current);
      applyAbortRef.current?.abort();
    };
  }, []);

  // Downsampled working copy for live previews. Computed once per file load;
  // falls through to identity when the source is already small.
  const previewSource = useMemo<RasterImage | null>(() => {
    if (!sourceImage) return null;
    return downsampleImage(sourceImage, PREVIEW_MAX_DIMENSION);
  }, [sourceImage]);

  const displayImage = useMemo<RasterImage | null>(() => {
    if (!sourceImage) return null;
    // Route any live-preview pipeline (Levels or Convolution) through the
    // downsampled copy so slider drag and slider-like inputs stay smooth on
    // multi-megapixel files. Channel mask alone is cheap and runs on source.
    if ((pipeline.levels || pipeline.convolution) && previewSource) {
      return applyPipeline(previewSource, pipeline);
    }
    return applyPipeline(sourceImage, pipeline);
  }, [sourceImage, previewSource, pipeline]);

  // On-screen CSS size of the canvas is driven by **sourceImage** dimensions,
  // not the bitmap inside the <canvas>. When a preview replaces the bitmap
  // with a downsampled copy, the rendered picture must stay the same CSS
  // size — the browser scales the smaller bitmap up for free.
  const canvasCssWidth = sourceImage
    ? Math.max(1, Math.round((sourceImage.width * viewZoom) / 100))
    : 0;
  const canvasCssHeight = sourceImage
    ? Math.max(1, Math.round((sourceImage.height * viewZoom) / 100))
    : 0;

  // Fit-to-view when image dimensions change (file load, destructive resize).
  // Same-size destructive Apply (Levels, Convolution) keeps the user's zoom.
  const prevDimsKeyRef = useRef<string>('');
  useEffect(() => {
    if (!sourceImage || !viewportRef.current) return;
    const key = `${sourceImage.width}x${sourceImage.height}`;
    if (prevDimsKeyRef.current === key) return;
    prevDimsKeyRef.current = key;
    const rect = viewportRef.current.getBoundingClientRect();
    setViewZoom(computeFitZoom(sourceImage, rect.width, rect.height));
  }, [sourceImage]);

  // Abort any in-flight convolution Apply when the user loads a new file so
  // a stale result doesn't overwrite the new sourceImage after async wakes.
  useEffect(() => {
    return () => {
      applyAbortRef.current?.abort();
    };
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
    if (levelsRafRef.current !== null) return;
    levelsRafRef.current = requestAnimationFrame(() => {
      levelsRafRef.current = null;
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
      // Dimensions change → previous coords and any in-flight preview no
      // longer apply to the new pixels.
      setPickedPixel(null);
      setPipeline((prev) => ({ ...prev, levels: null, convolution: null }));
      toast.success(`Размер изменён: ${newWidth} × ${newHeight}`);
    },
    [],
  );

  const handleConvolutionPreview = useCallback((params: ConvolutionParams | null) => {
    pendingConvolutionRef.current = params;
    hasPendingConvolutionRef.current = true;
    if (convolutionRafRef.current !== null) return;
    convolutionRafRef.current = requestAnimationFrame(() => {
      convolutionRafRef.current = null;
      if (!hasPendingConvolutionRef.current) return;
      hasPendingConvolutionRef.current = false;
      const next = pendingConvolutionRef.current;
      setPipeline((prev) => ({ ...prev, convolution: next }));
    });
  }, []);

  const handleConvolutionApply = useCallback(
    async (params: ConvolutionParams) => {
      if (!sourceImage) return;
      // Abort any prior in-flight Apply (defensive — the dialog disables its
      // Apply button while applying=true, but a second app-level trigger
      // would still race here without an explicit guard).
      applyAbortRef.current?.abort();
      const controller = new AbortController();
      applyAbortRef.current = controller;

      setFilterApplying(true);
      setFilterProgress(0);

      try {
        const result = await applyConvolutionAsync(sourceImage, params, {
          signal: controller.signal,
          onProgress: setFilterProgress,
        });
        if (controller.signal.aborted) return;
        setSourceImage(result);
        setPipeline((prev) => ({ ...prev, convolution: null }));
        setPickedPixel(null);
        toast.success('Фильтр применён');
      } catch (err) {
        if (err instanceof ConvolutionAbortError) {
          // Silent — the abort source (new file load, user closing) already
          // gave their own feedback.
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Ошибка применения фильтра: ${message}`);
      } finally {
        if (applyAbortRef.current === controller) {
          applyAbortRef.current = null;
        }
        setFilterApplying(false);
        setFilterProgress(0);
      }
    },
    [sourceImage],
  );

  // Opening one tool panel auto-cancels the other. Both panels clear their
  // own preview slot on open=false via their preview-push effect, so just
  // flipping the open flag is enough.
  const openLevelsPanel = useCallback(() => {
    setFilterOpen(false);
    setLevelsOpen(true);
  }, []);
  const openFilterPanel = useCallback(() => {
    setLevelsOpen(false);
    setFilterOpen(true);
  }, []);

  const { loadFile, isLoading } = useImageFile({
    onLoaded: handleLoaded,
    onError: handleError,
  });

  return (
    <div className="grid h-screen w-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-background text-foreground">
      <Toolbar
        image={sourceImage}
        onPickFile={loadFile}
        isLoading={isLoading}
        tool={tool}
        onToggleTool={handleToggleTool}
        onOpenLevels={openLevelsPanel}
        onOpenResize={() => setResizeOpen(true)}
        onOpenFilter={openFilterPanel}
      />
      <div className="flex min-h-0 min-w-0 flex-col lg:flex-row">
        <CanvasView
          ref={viewportRef}
          image={displayImage}
          cssWidth={canvasCssWidth}
          cssHeight={canvasCssHeight}
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
      {sourceImage && (
        <ConvolutionDialog
          image={sourceImage}
          open={filterOpen}
          onOpenChange={setFilterOpen}
          onPreview={handleConvolutionPreview}
          onApply={handleConvolutionApply}
          applying={filterApplying}
          progress={filterProgress}
        />
      )}
    </div>
  );
}
