import { boardGraphicHex, boardLines } from "./boardGraphic.js";

const emptyBoard = () => Array.from({ length: 6 }, () => Array(6).fill(null));

// Turns display lines back into a picture of the pins, "#" raised and "."
// lowered, using the Dot Pad's bit order (see brailleHex.js).
const DOT_BITS = { 1: 0x01, 2: 0x02, 3: 0x04, 4: 0x10, 5: 0x20, 6: 0x40, 7: 0x08, 8: 0x80 };
const DOT_PIN = { 1: [0, 0], 2: [0, 1], 3: [0, 2], 7: [0, 3], 4: [1, 0], 5: [1, 1], 6: [1, 2], 8: [1, 3] };

function picture(lines) {
  const rows = Array.from({ length: lines.length * 4 }, () => Array(lines[0].length * 2).fill("."));
  lines.forEach((cells, line) =>
    cells.forEach((hex, cell) => {
      const value = parseInt(hex, 16);
      for (const [dot, bit] of Object.entries(DOT_BITS)) {
        if (value & bit) {
          const [dx, dy] = DOT_PIN[dot];
          rows[line * 4 + dy][cell * 2 + dx] = "#";
        }
      }
    })
  );
  return rows.map((row) => row.join(""));
}

const SQUARES_ROW = "####..####..####..#..####..####..####...";
const GAP_ROW = "..................#.....................";

describe("boardLines", () => {
  it("draws an empty board: 4x4 solid squares, split into quadrants by a boundary cross", () => {
    const lines = boardLines(emptyBoard());
    const square = [SQUARES_ROW, SQUARES_ROW, SQUARES_ROW, SQUARES_ROW];

    expect(lines).toHaveLength(8);
    expect(lines[0]).toHaveLength(20);
    expect(picture(lines)).toEqual([
      ...square,
      GAP_ROW,
      ...square,
      GAP_ROW,
      ...square,
      GAP_ROW, // 1 blank dot row above the horizontal boundary...
      "#####################################...",
      GAP_ROW, // ...and 1 below
      ...square,
      GAP_ROW,
      ...square,
      GAP_ROW,
      ...square,
      "........................................",
    ]);
  });

  it("draws white as a hollow outline and black as a hollow ring", () => {
    const board = emptyBoard();
    board[0][0] = "white"; // A1, top-left quadrant
    board[0][4] = "black"; // E1, top-right quadrant (nudged one dot left)

    expect(picture(boardLines(board)).slice(0, 4)).toEqual([
      "####..####..####..#..####...##...####...",
      "#..#..####..####..#..####..#..#..####...",
      "#..#..####..####..#..####..#..#..####...",
      "####..####..####..#..####...##...####...",
    ]);
  });

  it("keeps the same two-dot gap either side of the vertical boundary", () => {
    const row = picture(boardLines(emptyBoard()))[0];
    expect(row.slice(14, 23)).toBe("##..#..##");
  });
});

describe("boardGraphicHex", () => {
  it("fills the whole 30 x 10 graphic area", () => {
    expect(boardGraphicHex(emptyBoard())).toHaveLength(30 * 10 * 2);
  });

  it("puts the board at the top-left and blanks everything else", () => {
    const hex = boardGraphicHex(emptyBoard());
    const line = (n) => hex.slice(n * 60, (n + 1) * 60);

    expect(line(0)).toBe(boardLines(emptyBoard())[0].join("") + "00".repeat(10));
    expect(line(8)).toBe("00".repeat(30));
    expect(line(9)).toBe("00".repeat(30));
  });

  it("clears the display when there is no board", () => {
    expect(boardGraphicHex(null)).toBe("00".repeat(300));
  });

  it("fits a device with a different graphic area", () => {
    expect(boardGraphicHex(emptyBoard(), 40, 12)).toHaveLength(40 * 12 * 2);
    // Smaller than the board: cut to fit rather than wrapping.
    expect(boardGraphicHex(emptyBoard(), 10, 6)).toHaveLength(10 * 6 * 2);
  });
});
