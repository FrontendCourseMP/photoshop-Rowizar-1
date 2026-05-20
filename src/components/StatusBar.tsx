import type { RasterImage } from '@/formats/types';
import type { PickedPixel } from '@/tools/types';
import { PixelInfoPanel } from './PixelInfoPanel';
import {
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  sliderToZoom,
  zoomToSlider,
} from '@/canvas/zoom';

type Props = {
  image: RasterImage | null;
  pickedPixel?: PickedPixel | null;
  viewZoom: number;
  onViewZoomChange: (zoom: number) => void;
};

const FORMAT_LABEL: Record<string, string> = {
  png: 'PNG',
  jpeg: 'JPEG',
  gb7: 'GB7',
};

function depthLabel(meta: RasterImage['meta']): string {
  if (meta.format === 'gb7') return meta.hasMask ? '7 + 1 бит' : '7 бит';
  return '24 бит';
}

export function StatusBar({ image, pickedPixel, viewZoom, onViewZoomChange }: Props) {
  return (
    <div className="border-t bg-card px-4 py-2 text-sm">
      <div className="flex items-center justify-between gap-3 text-muted-foreground">
        {image ? (
          <div className="flex items-center gap-3">
            <span>
              <span className="text-foreground">{image.width}</span> ×{' '}
              <span className="text-foreground">{image.height}</span> px
            </span>
            <span>·</span>
            <span>{depthLabel(image.meta)}</span>
            <span>·</span>
            <span>{FORMAT_LABEL[image.meta.format] ?? image.meta.format.toUpperCase()}</span>
            {image.meta.format === 'gb7' && image.meta.hasMask && (
              <>
                <span>·</span>
                <span className="text-foreground">с маской</span>
              </>
            )}
          </div>
        ) : (
          <span>Изображение не загружено</span>
        )}
        <ZoomControl
          value={viewZoom}
          onChange={onViewZoomChange}
          disabled={!image}
        />
      </div>
      {pickedPixel && (
        <div className="mt-1 border-t border-border/60 pt-1">
          <PixelInfoPanel pixel={pickedPixel} />
        </div>
      )}
    </div>
  );
}

type ZoomProps = {
  value: number;
  onChange: (next: number) => void;
  disabled: boolean;
};

function ZoomControl({ value, onChange, disabled }: ZoomProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <input
        type="range"
        min={0}
        max={100}
        step={0.1}
        value={zoomToSlider(value)}
        onChange={(event) => {
          const z = sliderToZoom(parseFloat(event.target.value));
          onChange(clampZoom(Math.round(z)));
        }}
        disabled={disabled}
        title="Масштаб — клавиши +/-, 0 для fit, 1 для 100%"
        className="h-1 w-32 cursor-pointer accent-foreground disabled:cursor-not-allowed"
      />
      <input
        type="number"
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={1}
        value={value}
        onChange={(event) => {
          const n = parseInt(event.target.value, 10);
          if (Number.isFinite(n)) onChange(clampZoom(n));
        }}
        disabled={disabled}
        aria-label="Масштаб в процентах"
        className="h-6 w-14 rounded border border-input bg-background px-1 text-right text-foreground disabled:cursor-not-allowed"
      />
      <span>%</span>
    </div>
  );
}
