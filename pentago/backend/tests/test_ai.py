import random

import pytest

from game_engine import Board, Color, Game, Status, apply_move
from game_engine.ai import Difficulty, _successors, choose_move, evaluate
from game_engine.game import win_for


def opponent_can_win_next(board: Board, color: Color) -> bool:
    """Whether ``color``'s opponent has a move that wins outright."""
    return any(status is win_for(color.opponent) for _, _, status in _successors(board, color.opponent))


@pytest.mark.parametrize("difficulty", list(Difficulty))
def test_returns_a_legal_move_on_an_empty_board(difficulty):
    move = choose_move(Board(), Color.BLACK, difficulty, random.Random(0))

    apply_move(Board(), Color.BLACK, move)  # raises if illegal


@pytest.mark.parametrize("difficulty", list(Difficulty))
def test_takes_an_immediate_win(difficulty):
    board = Board.from_rows([
        "WWWW..",
        "......",
        "BB.B..",
        "......",
        "....B.",
        "......",
    ])

    move = choose_move(board, Color.WHITE, difficulty, random.Random(0))

    _, status, _ = apply_move(board, Color.WHITE, move)
    assert status is Status.WHITE_WINS


@pytest.mark.parametrize("difficulty", [Difficulty.MEDIUM, Difficulty.HARD])
def test_blocks_an_immediate_threat(difficulty):
    # White threatens to place at (0,4) for five in row 0.
    board = Board.from_rows([
        "WWWW..",
        "......",
        "B...B.",
        "......",
        "..B...",
        "......",
    ])
    assert opponent_can_win_next(board, Color.BLACK)

    move = choose_move(board, Color.BLACK, difficulty, random.Random(0))

    after, status, _ = apply_move(board, Color.BLACK, move)
    assert status is Status.IN_PROGRESS
    assert not opponent_can_win_next(after, Color.BLACK)


def test_can_play_a_whole_game_against_itself():
    rng = random.Random(1)
    game = Game()
    while not game.status.is_over:
        game.play(choose_move(game.board, game.current_player, Difficulty.MEDIUM, rng))

    assert game.move_count <= 36


def test_evaluation_is_symmetric():
    board = Board.from_rows([
        "BB....",
        ".W....",
        "..B...",
        "...W..",
        "....WW",
        "B.....",
    ])

    assert evaluate(board, Color.BLACK) == -evaluate(board, Color.WHITE)


def test_successors_skip_duplicate_positions():
    # On an empty board every rotation of a single marble's quadrant is
    # distinct, but rotating any of the three empty quadrants changes nothing.
    successors = _successors(Board(), Color.BLACK)

    boards = {(b.black, b.white) for _, b, _ in successors}
    assert len(boards) == len(successors)
    assert len(successors) < 36 * 8
