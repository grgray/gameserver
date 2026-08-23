package game

import (
	"errors"
	"sync"
)

// Status describes how a game currently stands.
type Status string

const (
	StatusInProgress Status = "in_progress"
	StatusXWon       Status = "x_won"
	StatusOWon       Status = "o_won"
	StatusDraw       Status = "draw"
)

// ErrGameOver is returned by Move when the game has already finished.
var ErrGameOver = errors.New("game is already over")

// ErrIllegalMove is returned by Move when the requested cell is out of
// range or already occupied.
var ErrIllegalMove = errors.New("illegal move")

// Game tracks a single tic-tac-toe match: the board, whose turn it is and
// whether the game has been won or drawn. It is the shared engine behind
// both the interactive CLI and the REST API, and is safe for concurrent
// use so an HTTP handler can serve multiple requests for the same game.
type Game struct {
	mu      sync.Mutex
	board   Board
	current Mark
	status  Status
}

// NewGame returns a fresh game with an empty board; X moves first.
func NewGame() *Game {
	return &Game{board: *NewBoard(), current: X, status: StatusInProgress}
}

// State returns a snapshot of the board, the player to move next and the
// game's status. Once the game is over, current still names the mark that
// made the last move irrelevant to callers, so check status first.
func (g *Game) State() (board Board, current Mark, status Status) {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.board, g.current, g.status
}

// Move plays cell (0-8) for whichever mark currently has the turn, updates
// the game's status and returns the resulting snapshot. It fails with
// ErrGameOver if the game already ended, or ErrIllegalMove if the cell is
// out of range or occupied; the board is unchanged in both cases.
func (g *Game) Move(cell int) (board Board, current Mark, status Status, err error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.status != StatusInProgress {
		return g.board, g.current, g.status, ErrGameOver
	}

	mark := g.current
	if !g.board.Play(cell, mark) {
		return g.board, g.current, g.status, ErrIllegalMove
	}

	switch w := g.board.Winner(); {
	case w == X:
		g.status = StatusXWon
	case w == O:
		g.status = StatusOWon
	case g.board.Full():
		g.status = StatusDraw
	default:
		g.current = other(mark)
	}

	return g.board, g.current, g.status, nil
}

// other returns the mark belonging to the opposing player.
func other(m Mark) Mark {
	if m == X {
		return O
	}
	return X
}
