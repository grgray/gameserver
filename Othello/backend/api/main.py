"""REST API for the Othello game engine, built with FastAPI.

In-memory game store keyed by a random ID, same shape as the tictactoe
Go server: create a game, fetch its state, submit a move. When a game is
played against the computer, the computer's reply is applied automatically
after each human move.
"""

from __future__ import annotations

import secrets
import threading

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from game_engine.game import BOARD_SIZE, CellState, Difficulty, Game, new_game

app = FastAPI(title="Othello API")

_lock = threading.Lock()
_games: dict[str, Game] = {}

_DIFFICULTY_BY_NAME = {d.name.lower(): d for d in Difficulty}
_CELL_TO_STR = {CellState.EMPTY: "", CellState.BLACK: "black", CellState.WHITE: "white"}


class CreateGameRequest(BaseModel):
    difficulty: str = "medium"
    play_against_computer: bool = Field(default=False, alias="playAgainstComputer")

    model_config = {"populate_by_name": True}


class MoveRequest(BaseModel):
    row: int
    col: int


class ScoreResponse(BaseModel):
    black: int
    white: int
    winner: str


class GameState(BaseModel):
    id: str
    board: list[list[str]]
    current_player: str = Field(alias="currentPlayer")
    valid_moves: list[list[int]] = Field(alias="validMoves")
    difficulty: str
    play_against_computer: bool = Field(alias="playAgainstComputer")
    game_over: bool = Field(alias="gameOver")
    score: ScoreResponse

    model_config = {"populate_by_name": True}


def _serialize(game_id: str, game: Game) -> GameState:
    score = game.count_pieces()
    return GameState(
        id=game_id,
        board=[[_CELL_TO_STR[cell] for cell in row] for row in game.board],
        currentPlayer=_CELL_TO_STR[game.current_player],
        validMoves=[] if game.game_over else [list(move) for move in game.valid_moves()],
        difficulty=game.difficulty.name.lower(),
        playAgainstComputer=game.play_against_computer,
        gameOver=game.game_over,
        score=ScoreResponse(black=score.black, white=score.white, winner=score.winner),
    )


def _play_computer_if_needed(game: Game) -> None:
    """Play the computer's move(s), including any forced extra turn."""
    while game.play_against_computer and not game.game_over and game.current_player == game.computer_player:
        row, col = game.computer_move()
        if row == -1:
            break
        game.make_move(row, col)
        game.advance_turn()


@app.post("/games", status_code=201, response_model=GameState, response_model_by_alias=True)
def create_game(req: CreateGameRequest = CreateGameRequest()) -> GameState:
    difficulty = _DIFFICULTY_BY_NAME.get(req.difficulty.lower())
    if difficulty is None:
        raise HTTPException(400, "difficulty must be 'easy', 'medium', or 'hard'")

    game_id = secrets.token_hex(8)
    game = new_game(difficulty, req.play_against_computer)

    with _lock:
        _games[game_id] = game
        _play_computer_if_needed(game)

    return _serialize(game_id, game)


@app.get("/games/{game_id}", response_model=GameState, response_model_by_alias=True)
def get_game(game_id: str) -> GameState:
    game = _games.get(game_id)
    if game is None:
        raise HTTPException(404, "game not found")
    return _serialize(game_id, game)


@app.post("/games/{game_id}/moves", response_model=GameState, response_model_by_alias=True)
def make_move(game_id: str, req: MoveRequest) -> GameState:
    with _lock:
        game = _games.get(game_id)
        if game is None:
            raise HTTPException(404, "game not found")
        if game.game_over:
            raise HTTPException(409, "game is already over")
        if not (0 <= req.row < BOARD_SIZE and 0 <= req.col < BOARD_SIZE):
            raise HTTPException(400, f"row and col must be between 0 and {BOARD_SIZE - 1}")
        if game.play_against_computer and game.current_player == game.computer_player:
            raise HTTPException(409, "it is the computer's turn")
        if not game.is_valid_move(req.row, req.col):
            raise HTTPException(409, f"({req.row}, {req.col}) is not a legal move")

        game.make_move(req.row, req.col)
        game.advance_turn()
        _play_computer_if_needed(game)

        return _serialize(game_id, game)
