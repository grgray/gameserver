from game_engine.game import CellState, Difficulty, new_game


def test_new_game_sets_starting_position():
    game = new_game(Difficulty.MEDIUM, play_against_computer=False)

    assert game.board[3][3] == CellState.WHITE
    assert game.board[3][4] == CellState.BLACK
    assert game.board[4][3] == CellState.BLACK
    assert game.board[4][4] == CellState.WHITE
    assert game.current_player == CellState.BLACK
    assert game.computer_player == CellState.WHITE
    assert game.game_over is False


def test_initial_valid_moves_for_black():
    game = new_game(Difficulty.MEDIUM, play_against_computer=False)

    assert sorted(game.valid_moves()) == sorted([(2, 3), (3, 2), (4, 5), (5, 4)])


def test_make_move_flips_captured_pieces():
    game = new_game(Difficulty.MEDIUM, play_against_computer=False)

    assert game.is_valid_move(2, 3)
    game.make_move(2, 3)

    assert game.board[2][3] == CellState.BLACK
    assert game.board[3][3] == CellState.BLACK  # flipped from white


def test_advance_turn_switches_player():
    game = new_game(Difficulty.MEDIUM, play_against_computer=False)

    game.make_move(2, 3)
    game_over = game.advance_turn()

    assert game_over is False
    assert game.current_player == CellState.WHITE


def test_count_pieces_after_start():
    game = new_game(Difficulty.MEDIUM, play_against_computer=False)

    score = game.count_pieces()

    assert score.black == 2
    assert score.white == 2
    assert score.winner == "Tie"


def test_computer_move_returns_a_legal_move():
    game = new_game(Difficulty.EASY, play_against_computer=True)

    row, col = game.computer_move()

    assert game.is_valid_move(row, col)
