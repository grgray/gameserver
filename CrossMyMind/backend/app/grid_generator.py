from dataclasses import dataclass
from typing import List, Optional

from .models import Cell, ClueEntry, Clues, PuzzleResponse, WordClue

GRID_SIZE = 10
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
    size = len(grid)

    if direction == "across":
        if row < 0 or row >= size or col < 0 or col + length > size:
            return False
        if col - 1 >= 0 and grid[row][col - 1] is not None:
            return False
        if col + length < size and grid[row][col + length] is not None:
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
                if r + 1 < size and grid[r + 1][c] is not None:
                    return False
        return is_first or has_intersection

    if direction == "down":
        if col < 0 or col >= size or row < 0 or row + length > size:
            return False
        if row - 1 >= 0 and grid[row - 1][col] is not None:
            return False
        if row + length < size and grid[row + length][col] is not None:
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
                if c + 1 < size and grid[r][c + 1] is not None:
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
    size = len(grid)
    for direction in ("across", "down"):
        for i, ch in enumerate(word):
            for r in range(size):
                for c in range(size):
                    if grid[r][c] != ch:
                        continue
                    row, col = (r, c - i) if direction == "across" else (r - i, c)
                    if _can_place(grid, word, row, col, direction, is_first=False):
                        return row, col, direction
    return None


def _place_words(word_clues: List[WordClue], size: int) -> List[PlacedWord]:
    words = sorted(word_clues, key=lambda wc: len(wc.word), reverse=True)
    grid = [[None] * size for _ in range(size)]
    placed: List[PlacedWord] = []

    first = words[0]
    row0 = size // 2
    col0 = max(0, (size - len(first.word)) // 2)
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


def generate_grid(word_clues: List[WordClue], subject: str, size: int = GRID_SIZE) -> PuzzleResponse:
    candidates = [wc for wc in word_clues if 2 <= len(wc.word) <= size]
    if not candidates:
        raise GridGenerationError("No candidate words were short enough to fit the grid.")

    placed, grid = _place_words(candidates, size)
    if len(placed) < MIN_PLACED_WORDS:
        raise GridGenerationError(
            f"Only {len(placed)} words could be placed on the grid "
            f"(need at least {MIN_PLACED_WORDS}); try a different subject."
        )

    number_grid = [[None] * size for _ in range(size)]
    next_number = 1
    for r in range(size):
        for c in range(size):
            if grid[r][c] is None:
                continue
            starts_across = (c == 0 or grid[r][c - 1] is None) and (
                c + 1 < size and grid[r][c + 1] is not None
            )
            starts_down = (r == 0 or grid[r - 1][c] is None) and (
                r + 1 < size and grid[r + 1][c] is not None
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
            for c in range(size)
        ]
        for r in range(size)
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
        size=size,
        grid=cell_grid,
        clues=Clues(across=across, down=down),
    )
