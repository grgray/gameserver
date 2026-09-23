// Board helpers and wording shared by the UI. The server is the authority on
// every rule; these exist so the UI can preview a placement, animate a
// rotation and describe what happened in words.

export const SIZE = 6;
const QUADRANT_SIZE = 3;
const COLUMN_LETTERS = "ABCDEF";

export const QUADRANTS = [
  { id: "top-left", row: 0, col: 0 },
  { id: "top-right", row: 0, col: 3 },
  { id: "bottom-left", row: 3, col: 0 },
  { id: "bottom-right", row: 3, col: 3 },
];

export const DIRECTIONS = ["clockwise", "anticlockwise"];

const QUADRANT_BY_ID = Object.fromEntries(QUADRANTS.map((q) => [q.id, q]));

// Cells are named like a chessboard: column letter A-F, then row 1-6 from
// the top. Short enough for a braille line, unambiguous when read aloud.
export function cellName(row, col) {
  return `${COLUMN_LETTERS[col]}${row + 1}`;
}

export function quadrantAt(row, col) {
  return QUADRANTS.find(
    (q) => row >= q.row && row < q.row + QUADRANT_SIZE && col >= q.col && col < q.col + QUADRANT_SIZE
  ).id;
}

export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Where a cell ends up after a quarter turn of the given quadrant. Cells
// outside the quadrant don't move.
export function rotatePoint(row, col, quadrantId, direction) {
  const q = QUADRANT_BY_ID[quadrantId];
  const r = row - q.row;
  const c = col - q.col;
  if (r < 0 || r >= QUADRANT_SIZE || c < 0 || c >= QUADRANT_SIZE) return [row, col];
  const [nr, nc] =
    direction === "clockwise" ? [c, QUADRANT_SIZE - 1 - r] : [QUADRANT_SIZE - 1 - c, r];
  return [q.row + nr, q.col + nc];
}

export function rotateBoard(board, quadrantId, direction) {
  const next = board.map((row) => row.slice());
  const q = QUADRANT_BY_ID[quadrantId];
  for (let r = q.row; r < q.row + QUADRANT_SIZE; r++) {
    for (let c = q.col; c < q.col + QUADRANT_SIZE; c++) {
      const [nr, nc] = rotatePoint(r, c, quadrantId, direction);
      next[nr][nc] = board[r][c];
    }
  }
  return next;
}

export function placeMarble(board, row, col, color) {
  const next = board.map((r) => r.slice());
  next[row][col] = color;
  return next;
}

function buildLines() {
  const lines = [];
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const endR = r + dr * 4;
        const endC = c + dc * 4;
        if (endR < 0 || endR >= SIZE || endC < 0 || endC >= SIZE) continue;
        lines.push(Array.from({ length: 5 }, (_, i) => [r + dr * i, c + dc * i]));
      }
    }
  }
  return lines;
}

const LINES = buildLines();

export function hasFive(board, color) {
  return LINES.some((line) => line.every(([r, c]) => board[r][c] === color));
}

// The cell the last-placed marble sits in now, after its rotation.
export function lastPlacedCell(lastMove) {
  if (!lastMove) return null;
  const { row, col, rotation } = lastMove;
  return rotation ? rotatePoint(row, col, rotation.quadrant, rotation.direction) : [row, col];
}

export function winner(status) {
  if (status === "black_wins") return "black";
  if (status === "white_wins") return "white";
  return null;
}

export function isOver(status) {
  return status === "black_wins" || status === "white_wins" || status === "draw";
}

export function isMyTurn(game, colors) {
  return Boolean(game && game.status === "in_progress" && colors?.includes(game.currentPlayer));
}

// "Black placed at C2 and turned the top-left quadrant clockwise."
export function describeMove(lastMove) {
  if (!lastMove) return "";
  const who = capitalize(lastMove.player);
  const where = cellName(lastMove.row, lastMove.col);
  if (!lastMove.rotation) return `${who} placed at ${where}, making five in a row.`;
  const { quadrant, direction } = lastMove.rotation;
  return `${who} placed at ${where} and turned the ${quadrant} quadrant ${direction}.`;
}

// Whose turn it is, or how the game ended, from this player's point of view.
export function describeStatus(game, colors = []) {
  const onePlayerSeat = colors.length === 1;
  const computerColor = Object.entries(game.players).find(([, p]) => p.kind === "computer")?.[0];

  switch (game.status) {
    case "waiting_for_opponent":
      return "Waiting for an opponent to join.";
    case "draw":
      return "The game is a draw.";
    case "black_wins":
    case "white_wins": {
      const won = winner(game.status);
      if (!onePlayerSeat) return `${capitalize(won)} wins!`;
      if (colors.includes(won)) return `${capitalize(won)} wins. You win!`;
      return won === computerColor
        ? `${capitalize(won)} wins. The computer wins this one.`
        : `${capitalize(won)} wins. Your opponent wins this one.`;
    }
    default: {
      const turn = game.currentPlayer;
      if (!onePlayerSeat) return `${capitalize(turn)} to move.`;
      if (colors.includes(turn)) return `Your turn, ${turn}.`;
      if (turn === computerColor) return `The computer is thinking as ${turn}.`;
      return `Waiting for ${turn} to move.`;
    }
  }
}
