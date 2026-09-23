from dataclasses import dataclass
from typing import List, Optional

from .models import Cell, ClueEntry, Clues, PuzzleResponse, WordClue

GRID_ROWS = 10
GRID_COLS = 15
MIN_PLACED_WORDS = 5


@dataclass
class PlacedWord:
    word: str
    clue: str
    row: int
    col: int
    direction: str  # "across" | "down"


class GridGenerationError(Exception):
    """Raised when too few words could be placed to form a usable puzzle."""


def _can_place(grid, word: str, row: int, col: int, direction: str, is_first: bool) -> bool:
    length = len(word)
    rows = len(grid)
    cols = len(grid[0])

    if direction == "across":
        if row < 0 or row >= rows or col < 0 or col + length > cols:
            return False
        if col - 1 >= 0 and grid[row][col - 1] is not None:
            return False
        if col + length < cols and grid[row][col + length] is not None:
            return False
        has_intersection = False
        for i, ch in enumerate(word):
            r, c = row, col + i
            cell = grid[r][c]
            if cell is not None:
                if cell != ch:
                    return False
                has_intersection = True
            else:
                if r - 1 >= 0 and grid[r - 1][c] is not None:
                    return False
                if r + 1 < rows and grid[r + 1][c] is not None:
                    return False
        return is_first or has_intersection

    if direction == "down":
        if col < 0 or col >= cols or row < 0 or row + length > rows:
            return False
        if row - 1 >= 0 and grid[row - 1][col] is not None:
            return False
        if row + length < rows and grid[row + length][col] is not None:
            return False
        has_intersection = False
        for i, ch in enumerate(word):
            r, c = row + i, col
            cell = grid[r][c]
            if cell is not None:
                if cell != ch:
                    return False
                has_intersection = True
            else:
                if c - 1 >= 0 and grid[r][c - 1] is not None:
                    return False
                if c + 1 < cols and grid[r][c + 1] is not None:
                    return False
        return is_first or has_intersection

    raise ValueError(f"Unknown direction: {direction}")


def _place(grid, word: str, row: int, col: int, direction: str) -> None:
    for i, ch in enumerate(word):
        if direction == "across":
            grid[row][col + i] = ch
        else:
            grid[row + i][col] = ch


def _find_placement(grid, word: str) -> Optional[tuple]:
    rows = len(grid)
    cols = len(grid[0])
    for direction in ("across", "down"):
        for i, ch in enumerate(word):
            for r in range(rows):
                for c in range(cols):
                    if grid[r][c] != ch:
                        continue
                    row, col = (r, c - i) if direction == "across" else (r - i, c)
                    if _can_place(grid, word, row, col, direction, is_first=False):
                        return row, col, direction
    return None


def _place_words(word_clues: List[WordClue], rows: int, cols: int) -> List[PlacedWord]:
    words = sorted(word_clues, key=lambda wc: len(wc.word), reverse=True)
    grid = [[None] * cols for _ in range(rows)]
    placed: List[PlacedWord] = []

    first = words[0]
    row0 = rows // 2
    col0 = max(0, (cols - len(first.word)) // 2)
    if not _can_place(grid, first.word, row0, col0, "across", is_first=True):
        return placed, grid
    _place(grid, first.word, row0, col0, "across")
    placed.append(PlacedWord(first.word, first.clue, row0, col0, "across"))

    for wc in words[1:]:
        placement = _find_placement(grid, wc.word)
        if placement is None:
            continue
        row, col, direction = placement
        _place(grid, wc.word, row, col, direction)
        placed.append(PlacedWord(wc.word, wc.clue, row, col, direction))

    return placed, grid


def generate_grid(
    word_clues: List[WordClue],
    subject: str,
    rows: int = GRID_ROWS,
    cols: int = GRID_COLS,
) -> PuzzleResponse:
    max_len = max(rows, cols)
    candidates = [wc for wc in word_clues if 2 <= len(wc.word) <= max_len]
    if not candidates:
        raise GridGenerationError("No candidate words were short enough to fit the grid.")

    placed, grid = _place_words(candidates, rows, cols)
    if len(placed) < MIN_PLACED_WORDS:
        raise GridGenerationError(
            f"Only {len(placed)} words could be placed on the grid "
            f"(need at least {MIN_PLACED_WORDS}); try a different subject."
        )

    number_grid = [[None] * cols for _ in range(rows)]
    next_number = 1
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] is None:
                continue
            starts_across = (c == 0 or grid[r][c - 1] is None) and (
                c + 1 < cols and grid[r][c + 1] is not None
            )
            starts_down = (r == 0 or grid[r - 1][c] is None) and (
                r + 1 < rows and grid[r + 1][c] is not None
            )
            if starts_across or starts_down:
                number_grid[r][c] = next_number
                next_number += 1

    cell_grid = [
        [
            Cell(
                filled=grid[r][c] is not None,
                solution=grid[r][c],
                number=number_grid[r][c],
            )
            for c in range(cols)
        ]
        for r in range(rows)
    ]

    across: List[ClueEntry] = []
    down: List[ClueEntry] = []
    for pw in placed:
        number = number_grid[pw.row][pw.col]
        entry = ClueEntry(
            number=number,
            clue=pw.clue,
            answer_length=len(pw.word),
            row=pw.row,
            col=pw.col,
        )
        (across if pw.direction == "across" else down).append(entry)

    across.sort(key=lambda e: e.number)
    down.sort(key=lambda e: e.number)

    return PuzzleResponse(
        subject=subject,
        rows=rows,
        cols=cols,
        grid=cell_grid,
        clues=Clues(across=across, down=down),
    )
