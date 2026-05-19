import type { RasterImage } from '@/formats/types';

type Props = {
  image: RasterImage | null;
};

const FORMAT_LABEL: Record<string, string> = {
  png: 'PNG',
  jpeg: 'JPEG',
  gb7: 'GB7',
};

export function StatusBar({ image }: Props) {
  if (!image) {
    return (
      <div className="flex items-center justify-between border-t bg-card px-4 py-2 text-sm text-muted-foreground">
        <span>Изображение не загружено</span>
        <span>—</span>
      </div>
    );
  }

  const { width, height, meta } = image;
  // For GB7 with mask, depth is 7 (gray) + 1 (mask) = 8 bits/pixel.
  // For GB7 without mask, 7 bits/pixel. For PNG/JPEG, 8 bits per channel × channels.
  let depthLabel: string;
  if (meta.format === 'gb7') {
    depthLabel = meta.hasMask ? '7 + 1 бит' : '7 бит';
  } else {
    depthLabel = '24 бит';
  }

  return (
    <div className="flex items-center justify-between border-t bg-card px-4 py-2 text-sm">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span>
          <span className="text-foreground">{width}</span> × {' '}
          <span className="text-foreground">{height}</span> px
        </span>
        <span>·</span>
        <span>{depthLabel}</span>
        <span>·</span>
        <span>{FORMAT_LABEL[meta.format] ?? meta.format.toUpperCase()}</span>
        {meta.format === 'gb7' && meta.hasMask && (
          <>
            <span>·</span>
            <span className="text-foreground">с маской</span>
          </>
        )}
      </div>
    </div>
  );
}
