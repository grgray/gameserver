# othello backend

A Python port of the Go engine in `Othello/GameEngine/game.go`, wrapped in a
FastAPI REST API.

```
backend/
  game_engine/    Game rules, board, and minimax AI (no I/O, no framework code)
  api/             FastAPI app exposing the engine over HTTP
  tests/           pytest suite for both the engine and the API
```

## Setup

```sh
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Run the API

```sh
.venv/bin/uvicorn api.main:app --reload
```

Serves on `http://127.0.0.1:8000`. Interactive docs at `/docs`.

## Test

```sh
.venv/bin/python -m pytest
```

## API

- `POST /games` — create a game. Optional JSON body:
  `{"difficulty": "easy"|"medium"|"hard", "playAgainstComputer": bool}`
  (defaults: `"medium"`, `false`). Black always moves first; when playing
  against the computer, the computer always plays white.
- `GET /games/{id}` — fetch the current state.
- `POST /games/{id}/moves` — play a move: `{"row": int, "col": int}`
  (0-indexed). In a computer game, the computer's reply is applied
  automatically before the response is returned.

Game state responses look like:

```json
{
  "id": "56e742f8997838aa",
  "board": [["", "", ...], ...],
  "currentPlayer": "black",
  "validMoves": [[2, 3], [3, 2], [4, 5], [5, 4]],
  "difficulty": "easy",
  "playAgainstComputer": true,
  "gameOver": false,
  "score": {"black": 2, "white": 2, "winner": "Tie"}
}
```
