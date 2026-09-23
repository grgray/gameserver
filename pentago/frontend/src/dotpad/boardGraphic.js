// Draws the Pentago board on the Dot Pad's graphic area.
//
// Everything is drawn onto a grid of individual pins (2 across and 4 down
// per braille cell) and packed into cells at the end, so elements can sit
// at any dot position rather than only on cell boundaries.
//
// Each board square is 4 dots wide and 4 dots tall: two braille cells (a,
// b) across, using all four dot rows. Across, each square is followed by 2
// blank dot columns (one blank cell); down, by 1 blank dot row. A boundary
// cross through the middle splits the board into its four 3x3 quadrants:
//
// - the vertical boundary is one dot column (the left column of a cell),
//   running the full height of the board, with 2 blank dot columns on each
//   side of it;
// - the horizontal boundary is one dot row, with 1 blank dot row above and
//   below it, running from the left edge of the leftmost squares to the
//   right edge of the rightmost.
//
// The right-hand quadrants sit one dot left of the cell grid so the gap
// either side of the vertical boundary is the same. The board is 20 cells
// wide and 31 dots (8 lines) tall, starting at the top-left of the display;
// the rest of the display is sent blank so nothing from an earlier screen
// is left raised.

import { BrlToHex } from "./brailleHex.js";

// Each square's two cells, as braille dot numbers.
const SQUARE = {
  empty: ["12345678", "12345678"], // solid block
  white: ["123478", "145678"], // hollow outline
  black: ["2348", "1567"], // hollow ring
};

// The graphic area of a standard Dot Pad; a connected device reports its own.
export const DEFAULT_GRAPHIC_COLUMNS = 30;
export const DEFAULT_GRAPHIC_ROWS = 10;

const PINS_ACROSS = 2; // per braille cell
const PINS_DOWN = 4;

const QUADRANT_SQUARES = 3;
const SQUARE_HEIGHT = 4; // dots
const SQUARE_GAP_DOWN = 1; // blank dot rows below each square
const BOUNDARY_GAP = 1; // blank dot rows either side of the horizontal boundary

const CELLS_PER_SQUARE = 3; // a, b, blank
const HALF_WIDTH = QUADRANT_SQUARES * CELLS_PER_SQUARE; // cells in one quadrant's row
const BOUNDARY_CELL = HALF_WIDTH; // the cell whose left dot column is the vertical boundary
const RIGHT_START = BOUNDARY_CELL + 2; // after the boundary and its blank cell
const BOARD_CELLS = RIGHT_START + HALF_WIDTH;

// Dots shifted left, per quadrant: the vertical boundary only fills the left
// column of its cell, so without this the right-hand quadrants would sit one
// dot further from it than the left-hand ones.
const QUADRANT_PIN_SHIFT = { "top-left": 0, "top-right": -1, "bottom-left": 0, "bottom-right": -1 };

// Vertical layout, in dot rows from the top.
const SQUARE_PITCH = SQUARE_HEIGHT + SQUARE_GAP_DOWN;
const TOP_HALF_HEIGHT = QUADRANT_SQUARES * SQUARE_PITCH - SQUARE_GAP_DOWN;
const HORIZONTAL_BOUNDARY_Y = TOP_HALF_HEIGHT + BOUNDARY_GAP;
const BOTTOM_HALF_TOP = HORIZONTAL_BOUNDARY_Y + 1 + BOUNDARY_GAP;
const BOARD_PIN_HEIGHT = BOTTOM_HALF_TOP + TOP_HALF_HEIGHT;
const BOARD_LINES = Math.ceil(BOARD_PIN_HEIGHT / PINS_DOWN);

// Where each dot sits within its cell, as [pin column, pin row].
const DOT_PIN = {
  1: [0, 0],
  2: [0, 1],
  3: [0, 2],
  7: [0, 3],
  4: [1, 0],
  5: [1, 1],
  6: [1, 2],
  8: [1, 3],
};

class PinGrid {
  constructor(cellColumns, lines) {
    this.width = cellColumns * PINS_ACROSS;
    this.height = lines * PINS_DOWN;
    this.pins = Array.from({ length: this.height }, () => Array(this.width).fill(false));
  }

  raise(x, y) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) this.pins[y][x] = true;
  }

  // Raise a braille cell's dots with its top-left pin at (pinX, pinY).
  drawDots(dots, pinX, pinY) {
    for (const dot of dots) {
      const [dx, dy] = DOT_PIN[dot];
      this.raise(pinX + dx, pinY + dy);
    }
  }

  // Pack the pins back into cells: one array of hex cells per line.
  lines() {
    const out = [];
    for (let line = 0; line < this.height / PINS_DOWN; line++) {
      const cells = [];
      for (let cell = 0; cell < this.width / PINS_ACROSS; cell++) {
        let dots = "";
        for (const [dot, [dx, dy]] of Object.entries(DOT_PIN)) {
          if (this.pins[line * PINS_DOWN + dy][cell * PINS_ACROSS + dx]) dots += dot;
        }
        cells.push(BrlToHex(dots));
      }
      out.push(cells);
    }
    return out;
  }
}

function quadrantOf(row, col) {
  const vertical = row < QUADRANT_SQUARES ? "top" : "bottom";
  const horizontal = col < QUADRANT_SQUARES ? "left" : "right";
  return `${vertical}-${horizontal}`;
}

function squareTop(row) {
  const top = row < QUADRANT_SQUARES ? 0 : BOTTOM_HALF_TOP;
  return top + (row % QUADRANT_SQUARES) * SQUARE_PITCH;
}

function squareLeft(row, col) {
  const cellX = (col < QUADRANT_SQUARES ? 0 : RIGHT_START) + (col % QUADRANT_SQUARES) * CELLS_PER_SQUARE;
  return cellX * PINS_ACROSS + QUADRANT_PIN_SHIFT[quadrantOf(row, col)];
}

// The board as display lines, each an array of two-character hex cells.
export function boardLines(board) {
  const grid = new PinGrid(BOARD_CELLS, BOARD_LINES);

  board.forEach((row, r) => {
    row.forEach((color, c) => {
      const [a, b] = SQUARE[color ?? "empty"];
      const x = squareLeft(r, c);
      const y = squareTop(r);
      grid.drawDots(a, x, y);
      grid.drawDots(b, x + PINS_ACROSS, y);
    });
  });

  const verticalX = BOUNDARY_CELL * PINS_ACROSS;
  for (let y = 0; y < BOARD_PIN_HEIGHT; y++) grid.raise(verticalX, y);

  const leftEdge = Math.min(squareLeft(0, 0), squareLeft(QUADRANT_SQUARES, 0));
  const lastCol = QUADRANT_SQUARES * 2 - 1;
  const rightEdge =
    Math.max(squareLeft(0, lastCol), squareLeft(QUADRANT_SQUARES, lastCol)) + 2 * PINS_ACROSS - 1;
  for (let x = leftEdge; x <= rightEdge; x++) grid.raise(x, HORIZONTAL_BOUNDARY_Y);

  return grid.lines();
}

// The whole graphic area as one hex string, ready for displayDotPadGraphic:
// the board at the top-left, every other cell blank.
export function boardGraphicHex(board, columns = DEFAULT_GRAPHIC_COLUMNS, rows = DEFAULT_GRAPHIC_ROWS) {
  const blank = BrlToHex("");
  const lines = board ? boardLines(board) : [];
  let hex = "";
  for (let r = 0; r < rows; r++) {
    const cells = (lines[r] ?? []).slice(0, columns);
    hex += cells.join("") + blank.repeat(columns - cells.length);
  }
  return hex;
}
