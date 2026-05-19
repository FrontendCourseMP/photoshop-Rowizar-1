import { useCallback, useState } from 'react';
import type { RasterImage } from '@/formats/types';
import { detectFormat } from '@/formats';
import { decodeBrowser } from '@/formats/browser/decode';
import { decodeGB7 } from '@/formats/gb7/decode';

export type UseImageFileOptions = {
  onLoaded: (image: RasterImage) => void;
  onError: (message: string) => void;
};

/**
 * Unified file loader: works for both `<input type="file">` and drag-and-drop.
 * Format is detected from the file's signature bytes, not the extension —
 * a foo.png that starts with FF D8 FF is decoded as JPEG.
 */
export function useImageFile({ onLoaded, onError }: UseImageFileOptions) {
  const [isLoading, setLoading] = useState(false);

  const loadFile = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const format = await detectFormat(file);
        if (!format) {
          onError(`Неизвестный формат файла: ${file.name}`);
          return;
        }

        let image: RasterImage;
        if (format === 'gb7') {
          const buffer = await file.arrayBuffer();
          image = decodeGB7(buffer);
        } else {
          image = await decodeBrowser(file, format);
        }

        onLoaded(image);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        onError(message);
      } finally {
        setLoading(false);
      }
    },
    [onLoaded, onError],
  );

  return { loadFile, isLoading };
}
