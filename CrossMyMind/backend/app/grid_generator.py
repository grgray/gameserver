from dataclasses import dataclass
from typing import List

from .models import Cell, ClueEntry, Clues, PuzzleResponse, WordClue

GRID_ROWS = 10
GRID_COLS = 15
MIN_PLACED_WORDS = 5

# Caps the backtracking search below (one unit per word-placement decision
# considered, not per candidate) so a pathological candidate list can't
# blow up runtime. This is pure local computation with no network calls,
# and the search space here is tiny (a few dozen words at most), so this
# limit is never expected to bind in practice — it's a safety net, not a
# quality tradeoff.
MAX_BACKTRACK_ATTEMPTS = 4000


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


def _find_all_placements(grid, word: str) -> List[tuple]:
    """All distinct valid (row, col, direction) placements for word, in the
    order they're found scanning across-then-down, letter-by-letter,
    top-left to bottom-right — same search order _find_placement used to
    stop at the first match; here every match is kept as a candidate for
    the backtracking search below to try."""
    rows = len(grid)
    cols = len(grid[0])
    seen = set()
    results = []
    for direction in ("across", "down"):
        for i, ch in enumerate(word):
            for r in range(rows):
                for c in range(cols):
                    if grid[r][c] != ch:
                        continue
                    row, col = (r, c - i) if direction == "across" else (r - i, c)
                    key = (row, col, direction)
                    if key in seen:
                        continue
                    if _can_place(grid, word, row, col, direction, is_first=False):
                        seen.add(key)
                        results.append(key)
    return results


def _word_cells(length: int, row: int, col: int, direction: str) -> List[tuple]:
    if direction == "across":
        return [(row, col + i) for i in range(length)]
    return [(row + i, col) for i in range(length)]


def _unplace(grid, still_placed: List[PlacedWord], word: str, row: int, col: int, direction: str) -> None:
    """Reverses _place, but only actually clears a cell if no other
    currently-placed word (an intersection) still depends on it."""
    other_cells = set()
    for pw in still_placed:
        other_cells.update(_word_cells(len(pw.word), pw.row, pw.col, pw.direction))
    for r, c in _word_cells(len(word), row, col, direction):
        if (r, c) not in other_cells:
            grid[r][c] = None


def _place_words(word_clues: List[WordClue], rows: int, cols: int) -> List[PlacedWord]:
    words = sorted(word_clues, key=lambda wc: len(wc.word), reverse=True)
    grid = [[None] * cols for _ in range(rows)]

    first = words[0]
    row0 = rows // 2
    col0 = max(0, (cols - len(first.word)) // 2)
    if not _can_place(grid, first.word, row0, col0, "across", is_first=True):
        return [], grid
    _place(grid, first.word, row0, col0, "across")
    placed: List[PlacedWord] = [PlacedWord(first.word, first.clue, row0, col0, "across")]

    best_placed = list(placed)
    best_grid = [row[:] for row in grid]
    attempts = 0

    def backtrack(index: int) -> None:
        nonlocal attempts, best_placed, best_grid
        if attempts >= MAX_BACKTRACK_ATTEMPTS or index >= len(words):
            return
        attempts += 1
        wc = words[index]

        for row, col, direction in _find_all_placements(grid, wc.word):
            _place(grid, wc.word, row, col, direction)
            placed.append(PlacedWord(wc.word, wc.clue, row, col, direction))
            if len(placed) > len(best_placed):
                best_placed = list(placed)
                best_grid = [r[:] for r in grid]
            backtrack(index + 1)
            placed.pop()
            _unplace(grid, placed, wc.word, row, col, direction)
            if attempts >= MAX_BACKTRACK_ATTEMPTS:
                return

        # Also try skipping this word entirely — a later word may fit
        # better in the space it would have used.
        backtrack(index + 1)

    backtrack(1)
    return best_placed, best_grid


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
