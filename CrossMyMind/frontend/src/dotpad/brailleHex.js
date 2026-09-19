// Bit for each dot position in the graphic area's pin-hex format, as used by
// DotPadSDK's own internal graphic packer (packPinsToGraphicHex/PIN_BIT_TABLE
// in DotPadSDK-3.0.3.js). This is NOT the same bit order as standard Unicode
// braille patterns (where dot4=0x08, dot7=0x40) — here dots 4 and 7 swap
// places. Sending a cell built with the wrong order scrambles the pins for
// dots 4/5/6/7 on the physical display.
const DOT_BITS = {
  1: 0x01,
  2: 0x02,
  3: 0x04,
  4: 0x10,
  5: 0x20,
  6: 0x40,
  7: 0x08,
  8: 0x80,
};

// Converts a string of raised dot numbers (e.g. "135" for dots 1, 3 and 5)
// into the one-byte hex pattern for that cell on the Dot Pad graphic area.
// An empty/no-dot input returns "00" (all pins down).
export function BrlToHex(dots) {
  const digits = String(dots).match(/[1-8]/g) ?? [];
  let byte = 0;
  for (const digit of digits) {
    byte |= DOT_BITS[Number(digit)];
  }
  return byte.toString(16).padStart(2, '0');
}
