"""In-memory game store: games, player seats and WebSocket subscribers.

Each game has a secret token per player. A token maps to the colour(s) it
may move for: one colour in online and computer games, both in a local
(same-device) game. An online game also has a short join code that the
creator shares; the second player trades it for the other seat's token.

Nothing is persisted and finished games are never evicted; swap this module
for a database-backed one when that matters.
"""

from __future__ import annotations

import asyncio
import secrets
from dataclasses import dataclass, field
from enum import Enum

from fastapi import WebSocket

from game_engine import Color, Game
from game_engine.ai import Difficulty

# No 0/O or 1/I/L, so a code read aloud or brailled can't be misheard.
_JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_JOIN_CODE_LENGTH = 6


class Mode(Enum):
    ONLINE = "online"  # two people on separate devices
    LOCAL = "local"  # two people sharing one device
    COMPUTER = "computer"  # one person against the AI


@dataclass(eq=False)
class GameRecord:
    id: str
    mode: Mode
    game: Game = field(default_factory=Game)
    computer: Color | None = None
    difficulty: Difficulty | None = None
    tokens: dict[str, frozenset[Color]] = field(default_factory=dict)
    join_code: str | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    subscribers: set[WebSocket] = field(default_factory=set)

    def seated(self, color: Color) -> bool:
        """Whether a player (human or computer) occupies this colour's seat."""
        return color == self.computer or any(color in colors for colors in self.tokens.values())

    @property
    def waiting_for_opponent(self) -> bool:
        return not (self.seated(Color.BLACK) and self.seated(Color.WHITE))

    def colors_for(self, token: str) -> frozenset[Color]:
        for known, colors in self.tokens.items():
            if secrets.compare_digest(known, token):
                return colors
        return frozenset()

    def add_player(self, colors: frozenset[Color]) -> str:
        token = secrets.token_urlsafe(24)
        self.tokens[token] = colors
        return token

    @property
    def computer_to_move(self) -> bool:
        return not self.game.status.is_over and self.game.current_player == self.computer


class GameStore:
    def __init__(self) -> None:
        self._games: dict[str, GameRecord] = {}
        self._by_join_code: dict[str, GameRecord] = {}

    def create(self, mode: Mode) -> GameRecord:
        record = GameRecord(id=secrets.token_hex(8), mode=mode)
        self._games[record.id] = record
        return record

    def get(self, game_id: str) -> GameRecord | None:
        return self._games.get(game_id)

    def issue_join_code(self, record: GameRecord) -> str:
        while True:
            code = "".join(secrets.choice(_JOIN_CODE_ALPHABET) for _ in range(_JOIN_CODE_LENGTH))
            if code not in self._by_join_code:
                break
        record.join_code = code
        self._by_join_code[code] = record
        return code

    def claim_join_code(self, code: str) -> GameRecord | None:
        """Look up and retire a join code; each code seats exactly one player."""
        record = self._by_join_code.pop(code.strip().upper(), None)
        if record is not None:
            record.join_code = None
        return record


store = GameStore()
