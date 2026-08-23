# tictactoe

A two-player tic-tac-toe game with three front ends over one shared engine: an
interactive command line, a REST API, and an accessible React web app. All
three share the same Go game engine but ship as **separate binaries and
separate container images**, so they can be built, deployed and scaled
independently.

```
tictactoe/
  backend/        Go module: game engine + CLI + REST API
  frontend/       React (TypeScript) web app that drives the REST API
```

## Requirements

- Go 1.26 or later (declared in `backend/go.mod`)
- Node.js 22 or later and npm (for the React frontend)

## Play (web frontend)

The React app runs against the REST API. During development it proxies API
calls to a local server; in production the server serves the built app.

```sh
# terminal 1 — the API
cd backend
go run ./cmd/server

# terminal 2 — the frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

To run the built app in production, serve the compiled frontend from the API
so both live on one origin:

```sh
cd frontend
npm run build          # writes frontend/dist

cd ../backend
go run ./cmd/server -static ../frontend/dist
# open http://localhost:8080
```

The web frontend is accessible to screen readers and keyboard users: the board
is a grid of labelled buttons, live regions announce turns and results, and
the interface meets WCAG contrast and focus-visible requirements.

## Play (command line)

```sh
cd backend
go run ./cmd/cli
```

X moves first. The board shows a number in every free cell — type that number
to claim it:

```
  1 | 2 | 3
 ---+---+---
  4 | X | 6
 ---+---+---
  7 | 8 | O
```

Type `q` (or `quit`) to abandon the game. Invalid entries — non-numbers,
numbers outside 1-9, and cells that are already taken — are rejected with a
message and the same player is asked again, so a typo never costs a turn.

The game ends when a player completes a row, column or diagonal, or when the
board fills with no winner and the result is a draw.

## Play (REST API)

```sh
cd backend
go run ./cmd/server
```

This starts an HTTP server on `:8080` by default (override with
`-http=:PORT`). It holds multiple independent games in memory, each
identified by an ID handed back when the game is created; that ID goes in
the URL of every subsequent request for that game. State does not persist
across restarts.

| Method | Path                | Body               | Does                                               |
| ------ | ------------------- | ------------------- | --------------------------------------------------- |
| POST   | `/games`            | — or computer body  | Starts a new game, X to move first.                  |
| GET    | `/games/{id}`       | —                    | Returns the game's current state.                    |
| POST   | `/games/{id}/moves` | `{"cell": 1}`        | Plays cell 1-9 for whichever player's turn it is.    |

`POST /games` with no body (or `{"mode": "human"}`) starts a two-human game,
exactly as before. To play the computer instead, send:

```json
{ "mode": "computer", "level": 2, "mark": "O" }
```

- `level` is the computer's strength: `1` is easy (it takes a win and blocks
  an immediate loss but cannot see a fork, so a two-way threat beats it) and
  `2` is unbeatable (optimal minimax play — it never loses, so you can only
  draw or lose).
- `mark` is the symbol **you** play, `"X"` or `"O"` (defaults to `"X"`).
  X always moves first, so if you pick `"O"` the computer opens the game and
  the create response already contains its first move.

Games against the computer echo the same fields plus `mode`, `level` and
`mark`. Whenever you make a move the computer answers immediately, so the
response to `POST /games/{id}/moves` already reflects both moves.

Cells are numbered 1-9, left-to-right then top-to-bottom, matching the
numbers the CLI prints on an empty board.

Every successful response is the game's state as JSON:

```json
{
  "id": "b47645d77878ef51",
  "board": ["X", "X", "X", "O", "O", "", "", "", ""],
  "status": "x_won",
  "winner": "X"
}
```

- `board` is always 9 entries, row-major, `"X"`/`"O"`/`""` (empty).
- `status` is one of `in_progress`, `x_won`, `o_won`, `draw`.
- `turn` (`"X"` or `"O"`) is present only while `status` is `in_progress` —
  it names whose move is next. This is how a client detects that the move it
  just sent won or drew the game: `turn` disappears from the response.
- `winner` is present only once `status` is `x_won` or `o_won`.

Errors are `{"error": "..."}` with a matching status code: `400` for a
malformed body or a cell outside 1-9, `404` for an unknown game ID, `409` for
a move on an already-occupied cell or on a game that has already ended.

Example session:

```sh
id=$(curl -s -X POST localhost:8080/games | jq -r .id)
curl -s -X POST localhost:8080/games/$id/moves -d '{"cell": 1}'
curl -s localhost:8080/games/$id
```

### Serving the web app

Pass `-static <dir>` to serve a built frontend at `/` (with an SPA fallback to
`index.html`), so the API and the web app share one origin:

```sh
go run ./cmd/server -http=:8080 -static ../frontend/dist
```

API routes always take precedence over the static handler.

## Build

```sh
cd backend
go build -o bin/ ./cmd/cli ./cmd/server
```

The binaries land in `bin/`, which is git-ignored and created if missing.
Note the trailing slash: with a directory target Go names each output after
its package and adds the platform's executable extension, giving
`bin/cli`/`bin/server` on Linux and macOS and `bin/cli.exe`/`bin/server.exe`
on Windows.

## Test

```sh
cd backend
go test ./...             # unit tests plus scripted end-to-end games
go vet ./...
gofmt -l .                # prints nothing when formatting is clean

cd ../frontend
npm test                  # component + API-client tests
npm run lint              # eslint
npm run build             # type-check + production build
```

`cmd/cli`'s `run()` takes its input and output streams as parameters rather
than reading `os.Stdin` directly, which lets the tests drive complete games —
win, draw, quit and recovery from bad input — by feeding it a scripted
string. `cmd/server/server_test.go` does the equivalent for the API: it
starts a real `httptest.Server` and plays out games over HTTP, checking
status codes and JSON bodies. The frontend tests cover the API client and the
board's accessibility (via jest-axe).

## Architecture

The code is a shared engine package plus three thin front ends:

```
backend/internal/game       Board + Game: cell grid, move legality, win/draw
                             detection, turn tracking, computer opponent.
                             Game.Move is safe for concurrent callers.
       ↑              ↑               ↑
backend/cmd/cli   backend/cmd/server  frontend/ (React app)
(interactive CLI, (GameStore keyed    (calls the REST API; renders an
 stdin/stdout)     by ID; HTTP        accessible board, announces turns
                    handlers + JSON)   and results via live regions)
```

- **`backend/internal/game`** knows nothing about I/O or HTTP — just the
  board, whose turn it is, whether the game has been won or drawn, and the
  computer opponent. It is not importable outside the Go module (Go's
  `internal/` convention), since it only exists to be shared by the front
  ends.
- **`backend/cmd/cli`** is the interactive front end: it prints the board,
  reads and validates a cell number from stdin, and calls `Game.Move`.
- **`backend/cmd/server`** is the HTTP front end: `GameStore` holds one `Game`
  per ID in a map, and the handlers decode/encode JSON around
  `Game.State`/`Move`. It optionally serves the built web app.
- **`frontend/`** is the React front end: a typed API client (`src/api.ts`)
  talks to the REST API and components render the board, status and new-game
  form with screen-reader support.

All front ends produce identical game outcomes because they call the same
`Game` methods — the win/draw logic exists in exactly one place.

## Layout

| Path                          | Contents                                                        |
| ------------------------------ | ---------------------------------------------------------------- |
| `backend/internal/game/board.go` | `Board` type, move legality, win/draw detection, rendering     |
| `backend/internal/game/game.go`  | `Game` type: turn tracking and win/draw status over a `Board`  |
| `backend/internal/game/ai.go`    | Computer opponent: levels 1 (easy) and 2 (minimax)             |
| `backend/internal/game/*_test.go` | Unit tests for `Board`, `Game` and the AI                      |
| `backend/cmd/cli/main.go`        | Interactive CLI: game loop, move prompting, input validation   |
| `backend/cmd/cli/main_test.go`   | Full CLI-game tests through `run()`                             |
| `backend/cmd/server/main.go`     | Server entry point: parses `-http`/`-static` and starts the API |
| `backend/cmd/server/server.go`   | REST API: `GameStore`, HTTP handlers, JSON types, static serving |
| `backend/cmd/server/*_test.go`   | REST API + static-serving tests over real HTTP requests        |
| `frontend/src/`                  | React app: API client, board, status, new-game form            |
| `frontend/src/*.test.*`          | Vitest tests: API client, App flow, board accessibility        |

Module path: `github.com/readfern-gray/tictactoe`

## Containers

The CLI and the server build as separate images and can be deployed as
separate services; the server image also bakes in the built web app:

```sh
# REST API + web app
docker build -f Dockerfile.server -t tictactoe-server .
docker run -p 8080:8080 tictactoe-server

# Interactive CLI
docker build -f Dockerfile.cli -t tictactoe-cli .
docker run -it tictactoe-cli
```

Or with Compose, which wires up the same two images:

```sh
docker compose up server           # API + web app on :8080
docker compose run --rm cli        # plays one interactive game
```

## Notes

The board is a flat `[9]Mark` array in row-major order, indexed 0-8 internally;
the 1-9 numbering exists only at the user interface. Wins are checked against a
fixed table of the eight possible lines.

Each `Game` lives only in the server process's memory — restarting the server
(or its container) loses every game in progress. There's no persistence
layer, since none was needed for this exercise.
