# tictactoe

A two-player tic-tac-toe game. Play it interactively from the command line,
or run it as a REST API and drive it with HTTP requests instead — both
front ends share the same game engine but ship as **separate binaries and
separate container images**, so they can be built, deployed and scaled
independently.

## Requirements

- Go 1.26 or later (declared in `go.mod`)

## Play (command line)

```sh
cd tictactoe
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
go run ./cmd/server
```

This starts an HTTP server on `:8080` by default (override with
`-http=:PORT`). It holds multiple independent games in memory, each
identified by an ID handed back when the game is created; that ID goes in
the URL of every subsequent request for that game. State does not persist
across restarts.

| Method | Path                | Body               | Does                                               |
| ------ | ------------------- | ------------------- | --------------------------------------------------- |
| POST   | `/games`            | —                    | Starts a new game, X to move first.                  |
| GET    | `/games/{id}`       | —                    | Returns the game's current state.                    |
| POST   | `/games/{id}/moves` | `{"cell": 1}`        | Plays cell 1-9 for whichever player's turn it is.    |

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

## Build

```sh
go build -o bin/ ./cmd/cli ./cmd/server
```

The binaries land in `bin/`, which is git-ignored and created if missing.
Note the trailing slash: with a directory target Go names each output after
its package and adds the platform's executable extension, giving
`bin/cli`/`bin/server` on Linux and macOS and `bin/cli.exe`/`bin/server.exe`
on Windows.

## Test

```sh
go test ./...             # unit tests plus scripted end-to-end games
go vet ./...
gofmt -l .                # prints nothing when formatting is clean
```

`cmd/cli`'s `run()` takes its input and output streams as parameters rather
than reading `os.Stdin` directly, which lets the tests drive complete games —
win, draw, quit and recovery from bad input — by feeding it a scripted
string. `cmd/server/server_test.go` does the equivalent for the API: it
starts a real `httptest.Server` and plays out games over HTTP, checking
status codes and JSON bodies.

## Architecture

The code is a shared engine package plus two thin front ends, each its own
`main` package so it builds and deploys as an independent binary:

```
internal/game        Board + Game: cell grid, move legality, win/draw
                      detection, turn tracking. Game.Move is safe for
                      concurrent callers.
       ↑                        ↑
cmd/cli/main.go          cmd/server/{main,server}.go
(interactive CLI,       (GameStore keyed by ID; HTTP handlers translate
 stdin/stdout)           requests into Game.State()/Move() calls and the
                         result into JSON)
```

- **`internal/game`** knows nothing about I/O or HTTP — just the board, whose
  turn it is, and whether the game has been won or drawn. It is not
  importable outside this module (Go's `internal/` convention), since it
  only exists to be shared between `cmd/cli` and `cmd/server`.
- **`cmd/cli`** is the interactive front end: it prints the board, reads and
  validates a cell number from stdin, and calls `Game.Move`.
- **`cmd/server`** is the HTTP front end: `GameStore` holds one `Game` per ID
  in a map, and the handlers decode/encode JSON around `Game.State`/`Move`.

Both front ends produce identical game outcomes because they call the same
`Game` methods — the win/draw logic exists in exactly one place — but they
are built, containerized and run as two independent services with no
runtime dependency on each other.

## Layout

| Path                          | Contents                                                        |
| ------------------------------ | ---------------------------------------------------------------- |
| `internal/game/board.go`       | `Board` type, move legality, win/draw detection, rendering       |
| `internal/game/game.go`        | `Game` type: turn tracking and win/draw status over a `Board`    |
| `internal/game/*_test.go`      | Unit tests for `Board` and `Game`                                 |
| `cmd/cli/main.go`               | Interactive CLI: game loop, move prompting, input validation     |
| `cmd/cli/main_test.go`          | Full CLI-game tests through `run()`                               |
| `cmd/server/main.go`            | Server entry point: parses `-http` and starts the API            |
| `cmd/server/server.go`          | REST API: `GameStore`, HTTP handlers, JSON request/response types |
| `cmd/server/server_test.go`     | REST API tests: full games played over real HTTP requests         |

Module path: `github.com/readfern-gray/tictactoe`

## Containers

Each front end has its own Dockerfile, so the CLI and the API build as
separate images and can be deployed as separate services:

```sh
# REST API
docker build -f Dockerfile.server -t tictactoe-server .
docker run -p 8080:8080 tictactoe-server

# Interactive CLI
docker build -f Dockerfile.cli -t tictactoe-cli .
docker run -it tictactoe-cli
```

Or with Compose, which wires up the same two images:

```sh
docker compose up server           # starts the API on :8080
docker compose run --rm cli        # plays one interactive game
```

## Notes

The board is a flat `[9]Mark` array in row-major order, indexed 0-8 internally;
the 1-9 numbering exists only at the user interface. Wins are checked against a
fixed table of the eight possible lines.

Each `Game` lives only in the server process's memory — restarting the server
(or its container) loses every game in progress. There's no persistence
layer, since none was needed for this exercise.
