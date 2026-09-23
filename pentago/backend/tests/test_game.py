import pytest

from game_engine import Board, Color, Direction, Game, IllegalMove, Move, Quadrant, Rotation, Status, apply_move
from game_engine.board import LINES

CW = Direction.CLOCKWISE
ACW = Direction.ANTICLOCKWISE


def rot(quadrant: Quadrant, direction: Direction = CW) -> Rotation:
    return Rotation(quadrant, direction)


# --- board ---------------------------------------------------------------


def test_there_are_32_winning_lines():
    assert len(LINES) == 32


def test_place_adds_a_marble_without_changing_the_original():
    board = Board()
    placed = board.place(2, 4, Color.WHITE)

    assert placed.get(2, 4) is Color.WHITE
    assert board.get(2, 4) is None


def test_rotate_top_left_clockwise():
    board = Board.from_rows([
        "BW....",
        "......",
        "......",
        "......",
        "......",
        "......",
    ])

    assert board.rotate(Quadrant.TOP_LEFT, CW) == Board.from_rows([
        "..B...",
        "..W...",
        "......",
        "......",
        "......",
        "......",
    ])


def test_rotate_top_left_anticlockwise():
    board = Board.from_rows([
        "BW....",
        "......",
        "......",
        "......",
        "......",
        "......",
    ])

    assert board.rotate(Quadrant.TOP_LEFT, ACW) == Board.from_rows([
        "......",
        "W.....",
        "B.....",
        "......",
        "......",
        "......",
    ])


def test_rotation_only_moves_marbles_inside_the_quadrant():
    board = Board.from_rows([
        "B..W..",
        "......",
        "......",
        "...B.W",
        "......",
        "W.....",
    ])

    assert board.rotate(Quadrant.BOTTOM_RIGHT, CW) == Board.from_rows([
        "B..W..",
        "......",
        "......",
        ".....B",
        "......",
        "W....W",
    ])


@pytest.mark.parametrize("quadrant", list(Quadrant))
def test_four_quarter_turns_restore_the_board(quadrant):
    board = Board.from_rows([
        "BWB.WW",
        ".B.W.B",
        "W..BB.",
        "B.W..W",
        ".WB.B.",
        "WB..W.",
    ])

    turned = board
    for _ in range(4):
        turned = turned.rotate(quadrant, CW)

    assert turned == board
    assert board.rotate(quadrant, CW).rotate(quadrant, ACW) == board


@pytest.mark.parametrize(
    "rows",
    [
        ["BBBBB.", "......", "......", "......", "......", "......"],  # horizontal
        [".BBBBB", "......", "......", "......", "......", "......"],  # horizontal, offset
        ["......", "..B...", "..B...", "..B...", "..B...", "..B..."],  # vertical
        ["B.....", ".B....", "..B...", "...B..", "....B.", "......"],  # main diagonal
        [".B....", "..B...", "...B..", "....B.", ".....B", "......"],  # short diagonal
        ["......", ".....B", "....B.", "...B..", "..B...", ".B...."],  # anti-diagonal
    ],
)
def test_detects_five_in_a_row(rows):
    assert Board.from_rows(rows).has_five(Color.BLACK)


def test_four_in_a_row_is_not_five():
    board = Board.from_rows(["BBBB.B", "......", "......", "......", "......", "......"])

    assert not board.has_five(Color.BLACK)


# --- rules ---------------------------------------------------------------


def test_new_game_starts_empty_with_black_to_move():
    game = Game()

    assert game.current_player is Color.BLACK
    assert game.status is Status.IN_PROGRESS
    assert game.board == Board()


def test_move_places_rotates_and_passes_the_turn():
    game = Game()

    game.play(Move(0, 0, rot(Quadrant.TOP_LEFT, CW)))

    assert game.board.get(0, 2) is Color.BLACK
    assert game.current_player is Color.WHITE
    assert game.move_count == 1
    assert game.last_mover is Color.BLACK


def test_cannot_place_on_an_occupied_cell():
    game = Game()
    game.play(Move(4, 4, rot(Quadrant.TOP_LEFT)))

    with pytest.raises(IllegalMove, match="occupied"):
        game.play(Move(4, 4, rot(Quadrant.TOP_LEFT)))


@pytest.mark.parametrize("row, col", [(-1, 0), (0, 6), (6, 6)])
def test_cannot_place_off_the_board(row, col):
    with pytest.raises(IllegalMove, match="between 0 and 5"):
        Game().play(Move(row, col, rot(Quadrant.TOP_LEFT)))


def test_rotation_is_required_when_the_placement_does_not_win():
    with pytest.raises(IllegalMove, match="rotation"):
        Game().play(Move(0, 0))


def test_illegal_move_leaves_the_game_unchanged():
    game = Game()
    with pytest.raises(IllegalMove):
        game.play(Move(0, 0))

    assert game.board == Board()
    assert game.current_player is Color.BLACK
    assert game.move_count == 0


def test_placement_that_makes_five_wins_without_rotating():
    board = Board.from_rows([
        "BBBB..",
        "WWWW..",
        "......",
        "......",
        "......",
        "......",
    ])
    game = Game(board=board)

    # The rotation would break the line, but the placement already won.
    game.play(Move(0, 4, rot(Quadrant.TOP_LEFT, CW)))

    assert game.status is Status.BLACK_WINS
    assert game.last_move == Move(0, 4)
    assert game.board.get(0, 0) is Color.BLACK
    assert game.current_player is Color.BLACK


def test_rotation_that_completes_a_line_wins_for_the_mover():
    # Top-right anticlockwise sends (0,3) to (2,3) and (1,3) to (2,4).
    game = Game(board=Board.from_rows([
        "...B..",
        "......",
        "BBB...",
        "......",
        "......",
        "......",
    ]))

    game.play(Move(1, 3, rot(Quadrant.TOP_RIGHT, ACW)))

    assert game.status is Status.BLACK_WINS
    assert game.winning_lines() == [[(2, 0), (2, 1), (2, 2), (2, 3), (2, 4)]]


def test_rotation_that_completes_only_the_opponents_line_loses():
    game = Game(board=Board.from_rows([
        "...W..",
        "...W..",
        "WWW...",
        "......",
        "......",
        "......",
    ]))

    game.play(Move(5, 0, rot(Quadrant.TOP_RIGHT, ACW)))

    assert game.status is Status.WHITE_WINS


def test_rotation_that_completes_both_players_lines_is_a_draw():
    # The same rotation finishes black's row 2 and white's row 0.
    game = Game(board=Board.from_rows([
        "WWWB.W",
        ".....W",
        "BBB...",
        "......",
        "......",
        "......",
    ]))

    game.play(Move(1, 3, rot(Quadrant.TOP_RIGHT, ACW)))

    assert game.status is Status.DRAW
    assert len(game.winning_lines()) == 2


def test_full_board_with_no_five_is_a_draw():
    game = Game(
        board=Board.from_rows([
            "BBWWBW",
            "BBBW.W",
            "BWWBWW",
            "BWBBWB",
            "WBBWBB",
            "WWWBWB",
        ]),
        current_player=Color.WHITE,
    )

    game.play(Move(1, 4, rot(Quadrant.TOP_LEFT, CW)))

    assert game.board.is_full()
    assert game.status is Status.DRAW
    assert game.winning_lines() == []


def test_no_moves_after_the_game_is_over():
    game = Game(board=Board.from_rows([
        "BBBB..",
        "WWWW..",
        "......",
        "......",
        "......",
        "......",
    ]))
    game.play(Move(0, 4))

    with pytest.raises(IllegalMove, match="over"):
        game.play(Move(5, 5, rot(Quadrant.TOP_LEFT)))


def test_apply_move_does_not_mutate_the_board():
    board = Board()

    new_board, status, _ = apply_move(board, Color.BLACK, Move(0, 0, rot(Quadrant.TOP_LEFT)))

    assert board == Board()
    assert new_board.get(0, 2) is Color.BLACK
    assert status is Status.IN_PROGRESS
