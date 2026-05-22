import { useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { Channel, RasterImage } from '@/formats/types';
import type { ChannelMask } from '@/transforms/types';
import { extractChannelAsGrayscale } from '@/transforms/extractChannel';
import { cn } from '@/lib/utils';

const CHANNEL_LABELS: Record<Channel, string> = {
  R: 'Красный',
  G: 'Зелёный',
  B: 'Синий',
  A: 'Альфа',
  Gray: 'Серый',
};

const THUMB_WIDTH = 140;
const THUMB_HEIGHT = 48;

type Props = {
  image: RasterImage | null;
  channelMask: ChannelMask;
  onToggle: (channel: Channel) => void;
  className?: string;
};

export function ChannelsPanel({ image, channelMask, onToggle, className }: Props) {
  return (
    <aside
      className={cn(
        'flex flex-col border-t bg-card lg:w-56 lg:border-l lg:border-t-0',
        className,
      )}
    >
      <div className="border-b px-4 py-2 text-sm font-semibold">Каналы</div>
      {image ? (
        <div className="flex flex-row gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto">
          {image.meta.channels.map((ch) => (
            <ChannelThumbnail
              key={ch}
              image={image}
              channel={ch}
              enabled={channelMask[ch]}
              onToggle={() => onToggle(ch)}
            />
          ))}
        </div>
      ) : (
        <div className="p-4 text-sm text-muted-foreground">
          Откройте изображение, чтобы увидеть его каналы.
        </div>
      )}
    </aside>
  );
}

type ThumbProps = {
  image: RasterImage;
  channel: Channel;
  enabled: boolean;
  onToggle: () => void;
};

function ChannelThumbnail({ image, channel, enabled, onToggle }: ThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const targetW = THUMB_WIDTH;
    const targetH = THUMB_HEIGHT;

    const pixels = extractChannelAsGrayscale(image, channel);
    const imageData = new ImageData(pixels, image.width, image.height);

    const offscreen = new OffscreenCanvas(image.width, image.height);
    const offctx = offscreen.getContext('2d');
    if (!offctx) return;
    offctx.putImageData(imageData, 0, 0);

    const canvas = canvasRef.current;
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fixed-aspect "letterbox" fit: every channel renders into the same
    // elongated rectangle regardless of source image shape, so the panel
    // doesn't reflow for square vs. portrait images.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, targetW, targetH);
    const srcAspect = image.width / image.height;
    const dstAspect = targetW / targetH;
    let drawW: number;
    let drawH: number;
    if (srcAspect > dstAspect) {
      drawW = targetW;
      drawH = targetW / srcAspect;
    } else {
      drawH = targetH;
      drawW = targetH * srcAspect;
    }
    const drawX = (targetW - drawW) / 2;
    const drawY = (targetH - drawH) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offscreen, drawX, drawY, drawW, drawH);
  }, [image, channel]);

  return (
    <button
      type="button"
      onClick={onToggle}
      title={enabled ? 'Отключить канал' : 'Включить канал'}
      aria-pressed={enabled}
      className={cn(
        'flex shrink-0 flex-col gap-1 rounded-md border p-1.5 text-left transition-colors',
        enabled
          ? 'border-primary bg-primary/5'
          : 'border-border bg-muted/40 opacity-50 hover:opacity-80',
      )}
    >
      <canvas
        ref={canvasRef}
        className="block rounded-sm bg-black"
        style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
      />
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{CHANNEL_LABELS[channel]}</span>
        <span className="flex items-center gap-1 text-muted-foreground">
          {enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {channel}
        </span>
      </div>
    </button>
  );
}
