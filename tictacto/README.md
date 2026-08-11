# tictacto

A two-player tic-tac-toe game played from the command line. Both players share
one terminal and take turns entering moves.

## Requirements

- Go 1.26 or later (declared in `go.mod`)

## Play

```sh
cd tictacto
go run .
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

## Build

```sh
go build -o bin/ .
```

The binary lands in `bin/`, which is git-ignored and created if missing. Note
the trailing slash: with a directory target Go names the output after the
package and adds the platform's executable extension, giving `bin/tictacto` on
Linux and macOS and `bin/tictacto.exe` on Windows. Naming the file explicitly
instead (`-o bin/tictacto`) writes exactly that name on every platform, which
leaves you with an extensionless binary on Windows.

## Test

```sh
go test ./...             # unit tests plus scripted end-to-end games
go vet ./...
gofmt -l .                # prints nothing when formatting is clean
```

`run()` takes its input and output streams as parameters rather than reading
`os.Stdin` directly, which lets the tests drive complete games — win, draw,
quit and recovery from bad input — by feeding it a scripted string.

## Layout

| File             | Contents                                                      |
| ---------------- | ------------------------------------------------------------- |
| `main.go`        | Entry point, game loop, move prompting and input validation    |
| `board.go`       | `Board` type, move legality, win/draw detection, rendering     |
| `board_test.go`  | Board unit tests and full-game tests through `run()`           |

Module path: `github.com/readfern-gray/tictacto`

## Notes

The board is a flat `[9]Mark` array in row-major order, indexed 0-8 internally;
the 1-9 numbering exists only at the user interface. Wins are checked against a
fixed table of the eight possible lines.
