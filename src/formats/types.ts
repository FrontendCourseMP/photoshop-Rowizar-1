export type SourceFormat = 'png' | 'jpeg' | 'gb7';

/**
 * Semantic channels actually carrying information in the source file. The
 * in-memory pixel buffer is always RGBA (ImageData requires it), but a
 * decoded grayscale PNG with channels=['Gray'] has R=G=B and alpha=255 — the
 * meta tells the UI to render one thumbnail, not four duplicates. Channels
 * are derived from the file *header*, not from pixel content.
 */
export type Channel = 'R' | 'G' | 'B' | 'A' | 'Gray';

/**
 * Canonical in-memory representation of a raster image.
 *
 * All decoders return this shape, all encoders consume it, and the canvas
 * renderer reads from it. Keeping a single type isolates each format module
 * from the others and makes future filters straightforward (RasterImage →
 * RasterImage).
 */
export type RasterImage = {
  width: number;
  height: number;
  /** RGBA, row-major, 4 bytes per pixel — compatible with ImageData.data */
  pixels: Uint8ClampedArray<ArrayBuffer>;
  meta: {
    format: SourceFormat;
    /** Bits per channel in the source file: 8 for PNG/JPEG, 7 for GB7. */
    bitDepth: number;
    /** Semantic list of channels, derived from the file header. */
    channels: Channel[];
    /** GB7 only: duplicates presence of 'A' in channels, kept for the encoder. */
    hasMask?: boolean;
  };
};
