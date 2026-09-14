"""Othello (Reversi) game engine.

A straight port of the Go implementation in Othello/GameEngine/game.go —
same board representation, move rules and minimax AI, translated to Python.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import Enum

BOARD_SIZE = 8

_DIRECTIONS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


class CellState(Enum):
    EMPTY = 0
    BLACK = 1
    WHITE = 2


class Difficulty(Enum):
    EASY = 0
    MEDIUM = 1  # minimax depth 3
    HARD = 2  # minimax depth 5


Board = list[list[CellState]]


def _empty_board() -> Board:
    return [[CellState.EMPTY for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]


def opponent(player: CellState) -> CellState:
    return CellState.WHITE if player == CellState.BLACK else CellState.BLACK


def _in_bounds(row: int, col: int) -> bool:
    return 0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE


def _can_flip_in_direction(row: int, col: int, d_row: int, d_col: int, player: CellState, board: Board) -> bool:
    opp = opponent(player)
    r, c = row + d_row, col + d_col
    found_opponent = False
    while _in_bounds(r, c):
        cell = board[r][c]
        if cell == CellState.EMPTY:
            return False
        if cell == opp:
            found_opponent = True
        elif cell == player:
            return found_opponent
        r += d_row
        c += d_col
    return False


def _is_valid_move_on_board(row: int, col: int, player: CellState, board: Board) -> bool:
    if board[row][col] != CellState.EMPTY:
        return False
    return any(_can_flip_in_direction(row, col, dr, dc, player, board) for dr, dc in _DIRECTIONS)


def _valid_moves_on_board(player: CellState, board: Board) -> list[tuple[int, int]]:
    return [
        (row, col)
        for row in range(BOARD_SIZE)
        for col in range(BOARD_SIZE)
        if _is_valid_move_on_board(row, col, player, board)
    ]


def _has_valid_moves_on_board(player: CellState, board: Board) -> bool:
    return any(
        _is_valid_move_on_board(row, col, player, board)
        for row in range(BOARD_SIZE)
        for col in range(BOARD_SIZE)
    )


def _flip_in_direction(row: int, col: int, d_row: int, d_col: int, player: CellState, board: Board) -> None:
    r, c = row + d_row, col + d_col
    while _in_bounds(r, c) and board[r][c] != player:
        board[r][c] = player
        r += d_row
        c += d_col


def _make_move_on_board(row: int, col: int, player: CellState, board: Board) -> None:
    board[row][col] = player
    for d_row, d_col in _DIRECTIONS:
        if _can_flip_in_direction(row, col, d_row, d_col, player, board):
            _flip_in_direction(row, col, d_row, d_col, player, board)


def _count_pieces_in_direction(row: int, col: int, d_row: int, d_col: int, player: CellState, board: Board) -> int:
    opp = opponent(player)
    count = 0
    r, c = row + d_row, col + d_col
    while _in_bounds(r, c) and board[r][c] == opp:
        count += 1
        r += d_row
        c += d_col
    return count


@dataclass
class Score:
    black: int
    white: int
    winner: str  # "Black", "White", or "Tie"


def _count_pieces_on_board(board: Board) -> Score:
    black = sum(row.count(CellState.BLACK) for row in board)
    white = sum(row.count(CellState.WHITE) for row in board)
    if black > white:
        winner = "Black"
    elif white > black:
        winner = "White"
    else:
        winner = "Tie"
    return Score(black=black, white=white, winner=winner)


def _evaluate_board(board: Board, player: CellState) -> int:
    opp = opponent(player)
    score = 0
    player_pieces = opponent_pieces = 0
    player_mobility = opponent_mobility = 0

    for row in range(BOARD_SIZE):
        for col in range(BOARD_SIZE):
            cell = board[row][col]

            if cell == player:
                player_pieces += 1
            elif cell == opp:
                opponent_pieces += 1

            is_corner = row in (0, BOARD_SIZE - 1) and col in (0, BOARD_SIZE - 1)
            is_edge = row in (0, BOARD_SIZE - 1) or col in (0, BOARD_SIZE - 1)
            is_x_square = row in (1, BOARD_SIZE - 2) and col in (1, BOARD_SIZE - 2)

            if is_corner:
                if cell == player:
                    score += 100
                elif cell == opp:
                    score -= 100
            elif is_edge:
                if cell == player:
                    score += 5
                elif cell == opp:
                    score -= 5
            elif is_x_square:
                if cell == player:
                    score -= 20
                elif cell == opp:
                    score += 20

            if _is_valid_move_on_board(row, col, player, board):
                player_mobility += 1
            if _is_valid_move_on_board(row, col, opp, board):
                opponent_mobility += 1

    score += player_pieces - opponent_pieces
    score += (player_mobility - opponent_mobility) * 3
    return score


def _minimax(row: int, col: int, depth: int, board: Board, player: CellState, alpha: float, beta: float) -> float:
    new_board = [r[:] for r in board]
    _make_move_on_board(row, col, player, new_board)

    if depth == 0:
        return _evaluate_board(new_board, player)

    next_player = opponent(player)
    if not _has_valid_moves_on_board(next_player, new_board):
        next_player = player
        if not _has_valid_moves_on_board(next_player, new_board):
            return _evaluate_board(new_board, player)

    if next_player == player:
        # Maximising.
        max_score = -math.inf
        for r in range(BOARD_SIZE):
            for c in range(BOARD_SIZE):
                if _is_valid_move_on_board(r, c, next_player, new_board):
                    score = _minimax(r, c, depth - 1, new_board, next_player, alpha, beta)
                    max_score = max(max_score, score)
                    alpha = max(alpha, max_score)
                    if beta <= alpha:
                        return max_score
        if max_score == -math.inf:
            return _evaluate_board(new_board, player)
        return max_score

    # Minimising.
    min_score = math.inf
    for r in range(BOARD_SIZE):
        for c in range(BOARD_SIZE):
            if _is_valid_move_on_board(r, c, next_player, new_board):
                score = _minimax(r, c, depth - 1, new_board, next_player, alpha, beta)
                min_score = min(min_score, score)
                beta = min(beta, min_score)
                if beta <= alpha:
                    return min_score
    if min_score == math.inf:
        return _evaluate_board(new_board, player)
    return min_score


NO_MOVE = (-1, -1)


@dataclass
class Game:
    board: Board
    current_player: CellState
    difficulty: Difficulty
    play_against_computer: bool
    computer_player: CellState
    game_over: bool = False

    def opponent(self) -> CellState:
        return opponent(self.current_player)

    def is_valid_move(self, row: int, col: int) -> bool:
        return _is_valid_move_on_board(row, col, self.current_player, self.board)

    def valid_moves(self) -> list[tuple[int, int]]:
        return _valid_moves_on_board(self.current_player, self.board)

    def has_valid_moves(self, player: CellState) -> bool:
        return _has_valid_moves_on_board(player, self.board)

    def make_move(self, row: int, col: int) -> None:
        """Place a piece for the current player and flip captured pieces.

        Does not advance the turn — call advance_turn() after.
        """
        _make_move_on_board(row, col, self.current_player, self.board)

    def count_flipped_pieces(self, row: int, col: int) -> int:
        """How many opponent pieces placing at (row, col) would flip."""
        total = 0
        for d_row, d_col in _DIRECTIONS:
            if _can_flip_in_direction(row, col, d_row, d_col, self.current_player, self.board):
                total += _count_pieces_in_direction(row, col, d_row, d_col, self.current_player, self.board)
        return total

    def advance_turn(self) -> bool:
        """Switch to the opponent.

        If the opponent has no moves the current player moves again. If
        neither player has moves the game is over. Returns whether the game
        is now over.
        """
        nxt = opponent(self.current_player)
        if _has_valid_moves_on_board(nxt, self.board):
            self.current_player = nxt
            return False
        if _has_valid_moves_on_board(self.current_player, self.board):
            return False
        self.game_over = True
        return True

    def count_pieces(self) -> Score:
        return _count_pieces_on_board(self.board)

    def computer_move(self) -> tuple[int, int]:
        """Best (row, col) for the computer player, or NO_MOVE if none."""
        if self.difficulty == Difficulty.EASY:
            return self._computer_move_easy()
        if self.difficulty == Difficulty.HARD:
            return self._computer_move_minimax(5)
        return self._computer_move_minimax(3)  # Medium

    def _computer_move_easy(self) -> tuple[int, int]:
        """Pick the move that immediately flips the most pieces."""
        best_row, best_col, best_score = -1, -1, -1
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                if _is_valid_move_on_board(row, col, self.current_player, self.board):
                    flipped = self.count_flipped_pieces(row, col)
                    if flipped > best_score:
                        best_score = flipped
                        best_row, best_col = row, col
        return best_row, best_col

    def _computer_move_minimax(self, depth: int) -> tuple[int, int]:
        """Pick the best move using alpha-beta minimax at the given depth."""
        best_row, best_col, best_score = -1, -1, -math.inf
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                if _is_valid_move_on_board(row, col, self.current_player, self.board):
                    score = _minimax(row, col, depth, self.board, self.current_player, -math.inf, math.inf)
                    if score > best_score:
                        best_score = score
                        best_row, best_col = row, col
        return best_row, best_col


def new_game(difficulty: Difficulty, play_against_computer: bool) -> Game:
    board = _empty_board()
    board[3][3] = CellState.WHITE
    board[3][4] = CellState.BLACK
    board[4][3] = CellState.BLACK
    board[4][4] = CellState.WHITE
    return Game(
        board=board,
        current_player=CellState.BLACK,
        difficulty=difficulty,
        play_against_computer=play_against_computer,
        computer_player=CellState.WHITE,
    )
