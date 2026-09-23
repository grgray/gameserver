"""Pentago board: a 6x6 grid split into four 3x3 quadrants.

The board is stored as two 36-bit integers, one per colour, with cell
(row, col) at bit ``row * 6 + col``. Boards are immutable, so the AI can
explore thousands of positions without copying grids, and quadrant rotation
is a table lookup rather than a cell-by-cell shuffle.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from enum import Enum

SIZE = 6
CELLS = SIZE * SIZE
QUADRANT_SIZE = 3
WIN_LENGTH = 5

_FULL = (1 << CELLS) - 1


class Color(Enum):
    BLACK = "black"
    WHITE = "white"

    @property
    def opponent(self) -> Color:
        return Color.WHITE if self is Color.BLACK else Color.BLACK


class Quadrant(Enum):
    TOP_LEFT = "top-left"
    TOP_RIGHT = "top-right"
    BOTTOM_LEFT = "bottom-left"
    BOTTOM_RIGHT = "bottom-right"

    @property
    def origin(self) -> tuple[int, int]:
        """(row, col) of the quadrant's top-left cell."""
        return _QUADRANT_ORIGINS[self]


_QUADRANT_ORIGINS = {
    Quadrant.TOP_LEFT: (0, 0),
    Quadrant.TOP_RIGHT: (0, 3),
    Quadrant.BOTTOM_LEFT: (3, 0),
    Quadrant.BOTTOM_RIGHT: (3, 3),
}


class Direction(Enum):
    CLOCKWISE = "clockwise"
    ANTICLOCKWISE = "anticlockwise"


def bit(row: int, col: int) -> int:
    return 1 << (row * SIZE + col)


def cells_of(mask: int) -> list[tuple[int, int]]:
    """The (row, col) cells set in a bitmask, in reading order."""
    return [divmod(i, SIZE) for i in range(CELLS) if mask >> i & 1]


def _build_lines() -> list[int]:
    """Every run of five cells in a row: 12 horizontal, 12 vertical, 8 diagonal."""
    lines = []
    for d_row, d_col in ((0, 1), (1, 0), (1, 1), (1, -1)):
        for row in range(SIZE):
            for col in range(SIZE):
                end_row = row + d_row * (WIN_LENGTH - 1)
                end_col = col + d_col * (WIN_LENGTH - 1)
                if 0 <= end_row < SIZE and 0 <= end_col < SIZE:
                    mask = 0
                    for i in range(WIN_LENGTH):
                        mask |= bit(row + d_row * i, col + d_col * i)
                    lines.append(mask)
    return lines


LINES: list[int] = _build_lines()


def _quadrant_mask(quadrant: Quadrant) -> int:
    r0, c0 = quadrant.origin
    return sum(bit(r0 + r, c0 + c) for r in range(QUADRANT_SIZE) for c in range(QUADRANT_SIZE))


_QUADRANT_MASKS = {q: _quadrant_mask(q) for q in Quadrant}


def _rotated(local_row: int, local_col: int, direction: Direction) -> tuple[int, int]:
    """Where a cell inside a 3x3 quadrant ends up after a quarter turn."""
    if direction is Direction.CLOCKWISE:
        return local_col, QUADRANT_SIZE - 1 - local_row
    return QUADRANT_SIZE - 1 - local_col, local_row


def _build_rotation_table(quadrant: Quadrant, direction: Direction) -> list[int]:
    """Map each of the 512 possible 3x3 patterns to its rotated board bits.

    A pattern's bit ``r * 3 + c`` is the quadrant's local cell (r, c); the
    table entry is the same stones after rotation, placed on the full board.
    """
    r0, c0 = quadrant.origin
    table = []
    for pattern in range(1 << (QUADRANT_SIZE * QUADRANT_SIZE)):
        out = 0
        for i in range(QUADRANT_SIZE * QUADRANT_SIZE):
            if pattern >> i & 1:
                new_row, new_col = _rotated(*divmod(i, QUADRANT_SIZE), direction)
                out |= bit(r0 + new_row, c0 + new_col)
        table.append(out)
    return table


_ROTATION_TABLES = {(q, d): _build_rotation_table(q, d) for q in Quadrant for d in Direction}


def _rotate_bits(bits: int, quadrant: Quadrant, direction: Direction) -> int:
    r0, c0 = quadrant.origin
    shift = r0 * SIZE + c0
    pattern = (
        (bits >> shift & 0b111)
        | (bits >> (shift + SIZE) & 0b111) << 3
        | (bits >> (shift + 2 * SIZE) & 0b111) << 6
    )
    return bits & ~_QUADRANT_MASKS[quadrant] | _ROTATION_TABLES[quadrant, direction][pattern]


@dataclass(frozen=True, slots=True)
class Board:
    black: int = 0
    white: int = 0

    def stones(self, color: Color) -> int:
        return self.black if color is Color.BLACK else self.white

    def get(self, row: int, col: int) -> Color | None:
        b = bit(row, col)
        if self.black & b:
            return Color.BLACK
        if self.white & b:
            return Color.WHITE
        return None

    def is_empty(self, row: int, col: int) -> bool:
        return not (self.black | self.white) & bit(row, col)

    def is_full(self) -> bool:
        return self.black | self.white == _FULL

    def empty_cells(self) -> Iterator[tuple[int, int]]:
        occupied = self.black | self.white
        for i in range(CELLS):
            if not occupied >> i & 1:
                yield divmod(i, SIZE)

    def place(self, row: int, col: int, color: Color) -> Board:
        """Return a new board with a marble added. The cell must be empty."""
        b = bit(row, col)
        if color is Color.BLACK:
            return Board(self.black | b, self.white)
        return Board(self.black, self.white | b)

    def rotate(self, quadrant: Quadrant, direction: Direction) -> Board:
        return Board(
            _rotate_bits(self.black, quadrant, direction),
            _rotate_bits(self.white, quadrant, direction),
        )

    def winning_lines(self, color: Color) -> list[int]:
        stones = self.stones(color)
        return [line for line in LINES if stones & line == line]

    def has_five(self, color: Color) -> bool:
        stones = self.stones(color)
        return any(stones & line == line for line in LINES)

    def grid(self) -> list[list[Color | None]]:
        return [[self.get(row, col) for col in range(SIZE)] for row in range(SIZE)]

    @classmethod
    def from_rows(cls, rows: list[str]) -> Board:
        """Build a board from six strings of ``B``, ``W`` and ``.`` — handy in tests."""
        if len(rows) != SIZE or any(len(r) != SIZE for r in rows):
            raise ValueError("expected six rows of six characters")
        black = white = 0
        for row, line in enumerate(rows):
            for col, ch in enumerate(line):
                if ch == "B":
                    black |= bit(row, col)
                elif ch == "W":
                    white |= bit(row, col)
                elif ch != ".":
                    raise ValueError(f"unexpected character {ch!r}")
        return cls(black, white)
