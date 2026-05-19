import type { RasterImage } from '@/formats/types';
import type { PickedPixel } from '@/tools/types';
import { PixelInfoPanel } from './PixelInfoPanel';

type Props = {
  image: RasterImage | null;
  pickedPixel?: PickedPixel | null;
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

export function StatusBar({ image, pickedPixel }: Props) {
  return (
    <div className="border-t bg-card px-4 py-2 text-sm">
      <div className="flex items-center justify-between text-muted-foreground">
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
      </div>
      {pickedPixel && (
        <div className="mt-1 border-t border-border/60 pt-1">
          <PixelInfoPanel pixel={pickedPixel} />
        </div>
      )}
    </div>
  );
}
