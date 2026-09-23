"""Request and response bodies. JSON uses camelCase; Python uses snake_case."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from game_engine import SIZE, Color, Direction, Quadrant
from game_engine.ai import Difficulty

from .store import Mode


class _Schema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# --- requests ------------------------------------------------------------


class CreateGameRequest(_Schema):
    mode: Mode = Mode.ONLINE
    color: Color = Field(
        default=Color.BLACK,
        description="The creator's colour in online and computer games. Black moves first.",
    )
    difficulty: Difficulty = Field(default=Difficulty.MEDIUM, description="Computer games only.")


class JoinGameRequest(_Schema):
    code: str


class RotationBody(_Schema):
    quadrant: Quadrant
    direction: Direction


class MoveRequest(_Schema):
    row: int = Field(ge=0, lt=SIZE)
    col: int = Field(ge=0, lt=SIZE)
    rotation: RotationBody | None = Field(
        default=None,
        description="Required unless the placement itself makes five in a row.",
    )


# --- responses -----------------------------------------------------------

GameStatus = Literal["waiting_for_opponent", "in_progress", "black_wins", "white_wins", "draw"]


class PlayerInfo(_Schema):
    kind: Literal["human", "computer"]
    joined: bool


class LastMove(_Schema):
    player: Color
    row: int
    col: int
    rotation: RotationBody | None


class GameState(_Schema):
    id: str
    mode: Mode
    status: GameStatus
    board: list[list[Color | None]]
    current_player: Color
    move_count: int
    last_move: LastMove | None
    winning_lines: list[list[tuple[int, int]]]
    players: dict[Color, PlayerInfo]
    difficulty: Difficulty | None


class SeatResponse(_Schema):
    """Returned to whoever creates or joins a game: the only time a token is revealed."""

    game: GameState
    player_token: str
    colors: list[Color]
    join_code: str | None = None


class StateMessage(_Schema):
    """Pushed to WebSocket subscribers whenever a game changes."""

    type: Literal["state"] = "state"
    game: GameState
