export type SourceFormat = 'png' | 'jpeg' | 'gb7';

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
    /** GB7 only: whether the file carries a 1-bit mask in bit 7 of each pixel. */
    hasMask?: boolean;
  };
};
