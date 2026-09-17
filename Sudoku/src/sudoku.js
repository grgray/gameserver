// Core Sudoku generation and solving logic (no UI concerns here).

const SIZE = 9;
const BOX = 3;

function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function shuffledDigits() {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits;
}

function isSafe(board, row, col, value) {
  for (let i = 0; i < SIZE; i++) {
    if (board[row][i] === value || board[i][col] === value) return false;
  }
  const boxRow = row - (row % BOX);
  const boxCol = col - (col % BOX);
  for (let r = 0; r < BOX; r++) {
    for (let c = 0; c < BOX; c++) {
      if (board[boxRow + r][boxCol + c] === value) return false;
    }
  }
  return true;
}

function findEmptyCell(board) {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (board[row][col] === 0) return [row, col];
    }
  }
  return null;
}

// Fills `board` in place with a complete, randomly-generated valid solution.
function fillBoard(board) {
  const cell = findEmptyCell(board);
  if (!cell) return true;
  const [row, col] = cell;
  for (const value of shuffledDigits()) {
    if (isSafe(board, row, col, value)) {
      board[row][col] = value;
      if (fillBoard(board)) return true;
      board[row][col] = 0;
    }
  }
  return false;
}

export function generateSolvedGrid() {
  const board = emptyBoard();
  fillBoard(board);
  return board;
}

// Counts solutions up to `limit`, stopping early once the limit is reached.
// Used to confirm a puzzle has exactly one solution.
function countSolutions(board, limit = 2) {
  const cell = findEmptyCell(board);
  if (!cell) return 1;
  const [row, col] = cell;
  let count = 0;
  for (let value = 1; value <= 9; value++) {
    if (isSafe(board, row, col, value)) {
      board[row][col] = value;
      count += countSolutions(board, limit - count);
      board[row][col] = 0;
      if (count >= limit) break;
    }
  }
  return count;
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

// Difficulty is expressed as the number of clues (filled cells) left behind.
// Easy puzzles keep a generous number of clues so they are quick to reason
// through without needing advanced solving techniques.
const DIFFICULTY_CLUES = {
  easy: 40,
};

export function generatePuzzle(difficulty = 'easy') {
  const solution = generateSolvedGrid();
  const puzzle = cloneBoard(solution);
  const targetClues = DIFFICULTY_CLUES[difficulty] ?? DIFFICULTY_CLUES.easy;
  const cellsToClear = SIZE * SIZE - targetClues;

  const positions = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) positions.push([row, col]);
  }
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  let cleared = 0;
  for (const [row, col] of positions) {
    if (cleared >= cellsToClear) break;
    const backup = puzzle[row][col];
    puzzle[row][col] = 0;

    const testBoard = cloneBoard(puzzle);
    const solutions = countSolutions(testBoard, 2);
    if (solutions === 1) {
      cleared++;
    } else {
      puzzle[row][col] = backup;
    }
  }

  return { puzzle, solution };
}

export function isBoardComplete(grid) {
  return grid.every((row) => row.every((value) => value !== 0));
}

// Returns a Set of "row,col" keys for cells that conflict with another
// cell in the same row, column, or box.
export function findConflicts(grid) {
  const conflicts = new Set();

  const markIfDuplicate = (cells) => {
    const seen = new Map();
    for (const [row, col] of cells) {
      const value = grid[row][col];
      if (value === 0) continue;
      if (seen.has(value)) {
        conflicts.add(`${row},${col}`);
        conflicts.add(seen.get(value));
      } else {
        seen.set(value, `${row},${col}`);
      }
    }
  };

  for (let row = 0; row < SIZE; row++) {
    markIfDuplicate(Array.from({ length: SIZE }, (_, col) => [row, col]));
  }
  for (let col = 0; col < SIZE; col++) {
    markIfDuplicate(Array.from({ length: SIZE }, (_, row) => [row, col]));
  }
  for (let boxRow = 0; boxRow < SIZE; boxRow += BOX) {
    for (let boxCol = 0; boxCol < SIZE; boxCol += BOX) {
      const cells = [];
      for (let r = 0; r < BOX; r++) {
        for (let c = 0; c < BOX; c++) cells.push([boxRow + r, boxCol + c]);
      }
      markIfDuplicate(cells);
    }
  }

  return conflicts;
}
