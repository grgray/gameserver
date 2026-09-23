"""Pentago rules: turns, move legality and how a game ends.

A move is one placement plus one quadrant rotation. Following the official
rules:

- A player who makes five in a row with the placement wins at once and does
  not rotate.
- After the rotation, five in a row for the mover only is a win for the
  mover, for the opponent only a win for the opponent, and for both a draw.
- A full board with no five in a row is a draw.

No I/O or framework code lives here; the API and the AI both build on it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from .board import SIZE, Board, Color, Direction, Quadrant, cells_of


class Status(Enum):
    IN_PROGRESS = "in_progress"
    BLACK_WINS = "black_wins"
    WHITE_WINS = "white_wins"
    DRAW = "draw"

    @property
    def is_over(self) -> bool:
        return self is not Status.IN_PROGRESS


def win_for(color: Color) -> Status:
    return Status.BLACK_WINS if color is Color.BLACK else Status.WHITE_WINS


@dataclass(frozen=True, slots=True)
class Rotation:
    quadrant: Quadrant
    direction: Direction


@dataclass(frozen=True, slots=True)
class Move:
    row: int
    col: int
    rotation: Rotation | None = None


class IllegalMove(Exception):
    """Raised when a move breaks the rules; the message says why."""


def status_after_placement(board: Board, mover: Color) -> Status:
    return win_for(mover) if board.has_five(mover) else Status.IN_PROGRESS


def status_after_rotation(board: Board, mover: Color) -> Status:
    mover_five = board.has_five(mover)
    opponent_five = board.has_five(mover.opponent)
    if mover_five and opponent_five:
        return Status.DRAW
    if mover_five:
        return win_for(mover)
    if opponent_five:
        return win_for(mover.opponent)
    if board.is_full():
        return Status.DRAW
    return Status.IN_PROGRESS


def apply_move(board: Board, mover: Color, move: Move) -> tuple[Board, Status, Move]:
    """Play a move on a board, returning the new board, the resulting status
    and the move as actually played (without its rotation when the placement
    alone won)."""
    if not (0 <= move.row < SIZE and 0 <= move.col < SIZE):
        raise IllegalMove(f"row and col must be between 0 and {SIZE - 1}")
    if not board.is_empty(move.row, move.col):
        raise IllegalMove(f"cell ({move.row}, {move.col}) is already occupied")

    placed = board.place(move.row, move.col, mover)
    status = status_after_placement(placed, mover)
    if status.is_over:
        return placed, status, Move(move.row, move.col)

    if move.rotation is None:
        raise IllegalMove("a move must include a rotation unless the placement wins")
    rotated = placed.rotate(move.rotation.quadrant, move.rotation.direction)
    return rotated, status_after_rotation(rotated, mover), move


@dataclass
class Game:
    """A single game's mutable state. Black always moves first."""

    board: Board = field(default_factory=Board)
    current_player: Color = Color.BLACK
    status: Status = Status.IN_PROGRESS
    move_count: int = 0
    last_move: Move | None = None
    last_mover: Color | None = None

    def play(self, move: Move) -> None:
        """Play a move for the current player. Raises IllegalMove if it breaks the rules."""
        if self.status.is_over:
            raise IllegalMove("the game is already over")

        self.board, self.status, played = apply_move(self.board, self.current_player, move)
        self.last_move = played
        self.last_mover = self.current_player
        self.move_count += 1
        if not self.status.is_over:
            self.current_player = self.current_player.opponent

    def winning_lines(self) -> list[list[tuple[int, int]]]:
        """The five-in-a-row lines that ended the game (both players' on a double-five draw)."""
        if self.status is Status.IN_PROGRESS:
            return []
        lines = self.board.winning_lines(Color.BLACK) + self.board.winning_lines(Color.WHITE)
        return [cells_of(line) for line in lines]
