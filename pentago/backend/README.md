# pentago backend

Pentago rules, a computer opponent and a FastAPI server for online,
same-device and computer play. The server is the authority on every game:
clients send moves, the server validates and applies them, and anyone
watching a game over its WebSocket is pushed the new state.

```
backend/
  game_engine/   rules, board and AI (no I/O, no framework code)
    board.py       6x6 board as two bitboards; quadrant rotation; five-in-a-row lines
    game.py        turns, move legality, how a game ends
    ai.py          negamax + alpha-beta opponent, easy / medium / hard
  api/           FastAPI app
    main.py        REST routes and the WebSocket
    schemas.py     request and response bodies (camelCase JSON)
    store.py       in-memory games, seats, tokens and join codes
  tests/         pytest suite for the engine, the AI and the API
```

## Setup

```sh
cd pentago/backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # Windows
.venv/bin/pip install -r requirements.txt         # macOS / Linux
```

## Run

```sh
.venv/Scripts/uvicorn api.main:app --reload
```

Serves on `http://127.0.0.1:8000`. Interactive docs at `/docs`.

## Test

```sh
.venv/Scripts/python -m pytest
```

## Rules

Each turn, place a marble on an empty cell, then turn one of the four 3x3
quadrants a quarter turn clockwise or anticlockwise. Five in a row
(horizontal, vertical or diagonal) wins. Following the official rules:

- Five in a row straight from the placement wins at once; there is no rotation.
- After the rotation: five for the mover only wins; five for the opponent
  only loses; five for both is a draw.
- A full board with no five in a row is a draw.

Black always moves first.

## Game modes

| Mode       | Players                        | How seats are filled                                    |
| ---------- | ------------------------------ | ------------------------------------------------------- |
| `online`   | two people on separate devices | the creator gets a join code to share; the second player joins with it |
| `local`    | two people sharing one device  | one token plays both colours                            |
| `computer` | one person against the AI      | the computer takes the other colour and replies automatically |

## API

Moves need the player's token, returned only when they create or join a
game, sent as `Authorization: Bearer <token>`.

- `POST /games` — create a game. Optional body:
  `{"mode": "online"|"local"|"computer", "color": "black"|"white", "difficulty": "easy"|"medium"|"hard"}`
  (defaults: `"online"`, `"black"`, `"medium"`). `color` is the creator's
  colour; `difficulty` applies to computer games. Returns a seat (below).
  If the computer plays black, its first move follows straight away.
- `POST /games/join` — `{"code": "K7QM3R"}` (case-insensitive). Takes the
  open seat in an online game. Each code works once. Returns a seat.
- `GET /games/{id}` — the current state. No token needed.
- `POST /games/{id}/moves` — play a move for the token's colour:
  `{"row": 0-5, "col": 0-5, "rotation": {"quadrant": "top-left"|"top-right"|"bottom-left"|"bottom-right", "direction": "clockwise"|"anticlockwise"}}`.
  `rotation` may be left out only when the placement wins. Returns the new
  state. In a computer game the computer replies after the response is
  sent; watch the WebSocket (or poll `GET`) to see its move.
- `WS /games/{id}/ws` — sends `{"type": "state", "game": {...}}` on connect
  and after every change: a player joining, each move, the computer's
  replies. Read-only; moves go through REST. Closes with code 4404 for an
  unknown game.

A seat, returned by create and join:

```json
{
  "game": { ...state... },
  "playerToken": "u1ldlLhtY1IJJd_PeEWOv9HQ2SqaqxCr",
  "colors": ["black"],
  "joinCode": "K7QM3R"
}
```

A game state:

```json
{
  "id": "6af864f1fd0f3f92",
  "mode": "online",
  "status": "in_progress",
  "board": [["black", null, null, null, null, null], ...],
  "currentPlayer": "white",
  "moveCount": 1,
  "lastMove": {"player": "black", "row": 0, "col": 0,
               "rotation": {"quadrant": "top-left", "direction": "clockwise"}},
  "winningLines": [],
  "players": {"black": {"kind": "human", "joined": true},
              "white": {"kind": "human", "joined": true}},
  "difficulty": null
}
```

`status` is one of `waiting_for_opponent`, `in_progress`, `black_wins`,
`white_wins`, `draw`. `winningLines` lists the `[row, col]` cells of each
five-in-a-row once the game is won (both players' lines on a double-five
draw). `lastMove` is what makes an announcement like "White placed at row 1,
column 1 and turned the top-left quadrant clockwise" possible.

Errors: `401` missing or unknown token, `404` unknown game or join code,
`409` a move the rules or the turn order don't allow (the `detail` says
why), `422` a malformed request.

## The computer opponent

| Difficulty | Looks ahead | Behaviour                                         | Typical move time |
| ---------- | ----------- | ------------------------------------------------- | ----------------- |
| `easy`     | 1 move      | picks at random among its six best, but always takes a winning move | instant |
| `medium`   | 2 moves     | its move and your best reply                      | under 0.3 s       |
| `hard`     | 3 moves     | within a 3-second budget                          | about 1–2 s       |

Positions are scored by counting open lines (five-cell lines holding only
one colour), weighted steeply by how full they are.

## Not yet built

- Persistence: games live in memory and are lost on restart; finished games
  are never cleaned up.
- Reconnecting to a seat from a new device, rematches, move timers, accounts.
- A Dockerfile.
