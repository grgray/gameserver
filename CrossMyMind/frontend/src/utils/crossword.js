// Derives per-cell word membership from the puzzle's clue lists, so the grid
// and clue panel can agree on which cells belong to which across/down word
// without re-deriving that from the raw fill pattern.
export function buildWordMaps(puzzle) {
  const { size, clues } = puzzle;
  const acrossWordAt = Array.from({ length: size }, () => Array(size).fill(null));
  const downWordAt = Array.from({ length: size }, () => Array(size).fill(null));
  const wordCells = {};

  for (const entry of clues.across) {
    const cells = [];
    for (let i = 0; i < entry.answer_length; i++) {
      const c = entry.col + i;
      acrossWordAt[entry.row][c] = entry.number;
      cells.push([entry.row, c]);
    }
    wordCells[`across-${entry.number}`] = cells;
  }

  for (const entry of clues.down) {
    const cells = [];
    for (let i = 0; i < entry.answer_length; i++) {
      const r = entry.row + i;
      downWordAt[r][entry.col] = entry.number;
      cells.push([r, entry.col]);
    }
    wordCells[`down-${entry.number}`] = cells;
  }

  return { acrossWordAt, downWordAt, wordCells };
}

export function activeWordKey(row, col, direction, maps) {
  const primary = direction === "across" ? maps.acrossWordAt : maps.downWordAt;
  const secondary = direction === "across" ? maps.downWordAt : maps.acrossWordAt;
  if (primary[row][col] != null) {
    return `${direction}-${primary[row][col]}`;
  }
  const otherDirection = direction === "across" ? "down" : "across";
  if (secondary[row][col] != null) {
    return `${otherDirection}-${secondary[row][col]}`;
  }
  return null;
}

export function findNextFillable(puzzle, row, col, dr, dc) {
  const { size, grid } = puzzle;
  let r = row + dr;
  let c = col + dc;
  while (r >= 0 && r < size && c >= 0 && c < size) {
    if (grid[r][c].filled) return [r, c];
    r += dr;
    c += dc;
  }
  return null;
}

export function findFirstFillable(puzzle) {
  const { size, grid } = puzzle;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c].filled) return [r, c];
    }
  }
  return null;
}
