/**
 * GrayBit-7 format constants. Header layout (big-endian):
 *
 *   offset | size | field
 *   -------|------|-----------------------------------------------------------
 *    0     | 4    | signature  0x47 0x42 0x37 0x1D  ("GB7·")
 *    4     | 1    | version    0x01
 *    5     | 1    | flags      bit 0 = mask present; bits 1..7 reserved (=0)
 *    6     | 2    | width      uint16
 *    8     | 2    | height     uint16
 *    10    | 2    | reserved   0x0000
 *    12    | W*H  | pixel data, row-major, no padding
 */

export const GB7_SIGNATURE = [0x47, 0x42, 0x37, 0x1d] as const;
export const GB7_VERSION = 0x01;
export const GB7_HEADER_SIZE = 12;

export const GB7_FLAG_MASK = 0b0000_0001;
export const GB7_FLAG_RESERVED_BITS = 0b1111_1110;
