# Tic-tac-toe: computer opponent + REST API support

## Goal
Add a computer opponent with two difficulty levels, expose it through the REST
API (while keeping the existing human-vs-human API unchanged), and add unit
tests.

## Decisions (confirmed with user)
- Level 1 ("easy"): take an immediate win, else block an immediate loss, else
  play the first empty cell. Fork-blind by design, so a human wins with a
  two-way threat.
- Level 2 ("unbeatable"): minimax/negamax. Never loses (win or draw).
- API: optional JSON body on `POST /games`. Omit body (or `{"mode":"human"}`)
  for the current two-human game; `{"mode":"computer","level":N,"mark":"X"|"O"}`
  for a computer game. `mark` is the human's symbol and defaults to `"X"`.
  X always moves first, so a human choosing `O` sees the computer open.

## Changes

### 1. `internal/game/ai.go` (new)
- `type Level int` with `Level1 = 1`, `Level2 = 2`.
- `ChooseMove(board Board, mark Mark, level Level) int` (returns cell 0-8).
- `easyMove` (win/block/first-empty), `winningMove`, `bestMove`, `minimax`.

### 2. `internal/game/ai_test.go` (new)
- `TestEasyMoveTakesWin`, `TestEasyMoveBlocksWin`, `TestEasyMovePicksFirstEmpty`.
- `TestLevel1AllowsFork`: board `O@0, X@4, X@8` (O to move) -> Level 1 picks
  edge cell 1 (fails to block fork).
- `TestLevel2BlocksFork`: same board -> Level 2 picks corner (2 or 6).
- `TestLevel2TakesWin`, `TestLevel2VsLevel2Draws`, `TestLevel2NeverLosesToDumbHuman`.

### 3. `cmd/server/server.go` (edit)
- `GameStore` now holds `map[string]*Match`; `Match` wraps `*game.Game` plus
  `mode`, `level`, `humanMark`.
- `Create()` (human) and `CreateComputer(level, mark)` (auto-opens as X when
  human is O). `playComputer()` applies the computer move.
- `createRequest{Mode, Level, Mark}` decoded on `POST /games` (tolerates
  empty body); validation: unknown mode / level not 1-2 / bad mark -> 400.
- `handleMove`: in computer mode, reject non-human turn (409); after a legal
  human move, auto-play the computer and return the combined state.
- `stateResponse` gains `mode`/`level`/`mark` (omitempty) — populated only for
  computer games so human games stay byte-identical.
- `writeState` replaced by `writeMatch`.

### 4. `cmd/server/server_test.go` (edit)
- `TestServerCreateComputerGame`, `TestServerComputerLevel1HumanWinsByFork`
  (human X: 5,9,3,7 -> X wins), `TestServerComputerLevel2NeverLoses`,
  `TestServerCreateComputerDefaultsMarkToX`,
  `TestServerCreateComputerRejectsBadRequests`.
- Existing human-vs-human tests remain untouched.

### 5. `README.md` (edit)
- Document the `POST /games` body, computer mode, levels 1/2, X-first rule,
  and new response fields.

## Verification
```
go test ./...
go vet ./...
gofmt -l .
```
