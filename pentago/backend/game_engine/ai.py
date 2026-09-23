"""Computer opponent: shallow negamax search with alpha-beta pruning.

Pentago is solved (first player wins), so the aim is a fun opponent, not a
perfect one. Strength is set by search depth plus a little randomness:

- easy:   looks one move ahead and picks among its better moves at random,
          though it never misses a move that wins on the spot.
- medium: looks two moves ahead (its move and your reply).
- hard:   looks three moves ahead, within a time budget.

Positions are scored by counting open lines: a five-cell line holding only
one colour is worth more the more stones it has.
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass
from enum import Enum

from .board import LINES, Board, Color, Direction, Quadrant
from .game import Move, Rotation, Status, status_after_placement, status_after_rotation, win_for


class Difficulty(Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


@dataclass(frozen=True)
class _Settings:
    depth: int
    time_budget: float  # seconds; deeper searches stop early and keep the last finished depth
    pick_from_top: int  # choose at random among this many best root moves


_SETTINGS = {
    Difficulty.EASY: _Settings(depth=1, time_budget=1.0, pick_from_top=6),
    Difficulty.MEDIUM: _Settings(depth=2, time_budget=2.0, pick_from_top=1),
    Difficulty.HARD: _Settings(depth=3, time_budget=3.0, pick_from_top=1),
}

WIN_SCORE = 1_000_000
# Score for a line holding n stones of one colour and none of the other.
_LINE_VALUES = (0, 1, 8, 64, 512, WIN_SCORE)

_ROTATIONS = [Rotation(q, d) for q in Quadrant for d in Direction]


class _OutOfTime(Exception):
    pass


def evaluate(board: Board, color: Color) -> int:
    """Static score of a position from ``color``'s point of view."""
    mine, theirs = board.stones(color), board.stones(color.opponent)
    score = 0
    for line in LINES:
        m, t = mine & line, theirs & line
        if m and not t:
            score += _LINE_VALUES[m.bit_count()]
        elif t and not m:
            score -= _LINE_VALUES[t.bit_count()]
    return score


def _successors(board: Board, color: Color) -> list[tuple[Move, Board, Status]]:
    """Every distinct position ``color`` can reach in one move.

    Moves that lead to the same board (rotating an empty or symmetric
    quadrant, say) are only searched once.
    """
    seen: set[tuple[int, int]] = set()
    result = []
    for row, col in board.empty_cells():
        placed = board.place(row, col, color)
        status = status_after_placement(placed, color)
        if status.is_over:
            result.append((Move(row, col), placed, status))
            continue
        for rotation in _ROTATIONS:
            after = placed.rotate(rotation.quadrant, rotation.direction)
            key = (after.black, after.white)
            if key in seen:
                continue
            seen.add(key)
            result.append((Move(row, col, rotation), after, status_after_rotation(after, color)))
    return result


def _terminal_score(status: Status, color: Color, depth: int) -> int:
    """Score a finished game for ``color``; sooner wins and later losses score better."""
    if status is Status.DRAW:
        return 0
    return WIN_SCORE + depth if status is win_for(color) else -(WIN_SCORE + depth)


class _Search:
    def __init__(self, deadline: float) -> None:
        self.deadline = deadline
        self.nodes = 0

    def negamax(self, board: Board, color: Color, depth: int, alpha: int, beta: int) -> int:
        """Best score ``color`` (to move on ``board``) can force, looking ``depth`` moves ahead."""
        self.nodes += 1
        if self.nodes & 1023 == 0 and time.monotonic() > self.deadline:
            raise _OutOfTime
        if depth == 0:
            return evaluate(board, color)

        children = _successors(board, color)
        if depth > 1:
            children.sort(key=lambda child: evaluate(child[1], color), reverse=True)

        best = -WIN_SCORE * 2
        for _, child, status in children:
            if status.is_over:
                score = _terminal_score(status, color, depth)
            else:
                score = -self.negamax(child, color.opponent, depth - 1, -beta, -alpha)
            if score > best:
                best = score
                if score > alpha:
                    alpha = score
                    if alpha >= beta:
                        break
        return best

    def score_root(self, board: Board, color: Color, depth: int, rng: random.Random) -> list[tuple[int, Move]]:
        """Score every root move. Scores are exact for the best move and upper bounds for the rest."""
        children = _successors(board, color)
        rng.shuffle(children)  # vary play between equally good moves
        if depth > 1:
            children.sort(key=lambda child: evaluate(child[1], color), reverse=True)

        scored = []
        alpha = -WIN_SCORE * 2
        for move, child, status in children:
            if status.is_over:
                score = _terminal_score(status, color, depth)
            else:
                score = -self.negamax(child, color.opponent, depth - 1, -WIN_SCORE * 2, -alpha)
            scored.append((score, move))
            alpha = max(alpha, score)
        return scored


def choose_move(board: Board, color: Color, difficulty: Difficulty, rng: random.Random | None = None) -> Move:
    """Pick a move for ``color``. The board must have at least one empty cell."""
    rng = rng or random.Random()
    settings = _SETTINGS[difficulty]
    deadline = time.monotonic() + settings.time_budget

    scored: list[tuple[int, Move]] = []
    # Iterative deepening: a deeper search that runs out of time falls back
    # to the last depth that finished.
    for depth in range(1, settings.depth + 1):
        try:
            scored = _Search(deadline).score_root(board, color, depth, rng)
        except _OutOfTime:
            break
    if not scored:
        raise ValueError("no legal moves")

    scored.sort(key=lambda sm: sm[0], reverse=True)
    best_score, best_move = scored[0]
    if best_score >= WIN_SCORE or settings.pick_from_top == 1:
        return best_move
    return rng.choice(scored[: settings.pick_from_top])[1]
