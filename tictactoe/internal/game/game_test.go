package game

import (
	"errors"
	"testing"
)

func TestNewGameStartsWithXToMove(t *testing.T) {
	g := NewGame()
	board, current, status := g.State()

	if status != StatusInProgress {
		t.Errorf("new game status = %q, want %q", status, StatusInProgress)
	}
	if current != X {
		t.Errorf("new game current = %c, want %c", current, X)
	}
	if !board.Full() && board.Winner() != Empty {
		t.Errorf("new board should have no winner")
	}
	for _, m := range board {
		if m != Empty {
			t.Fatalf("new board is not empty: %+v", board)
		}
	}
}

func TestGameMoveAlternatesTurns(t *testing.T) {
	g := NewGame()

	_, current, _, err := g.Move(0)
	if err != nil {
		t.Fatalf("Move(0) returned error: %v", err)
	}
	if current != O {
		t.Errorf("current after X moves = %c, want %c", current, O)
	}

	_, current, _, err = g.Move(1)
	if err != nil {
		t.Fatalf("Move(1) returned error: %v", err)
	}
	if current != X {
		t.Errorf("current after O moves = %c, want %c", current, X)
	}
}

func TestGameMoveRejectsOccupiedCell(t *testing.T) {
	g := NewGame()
	if _, _, _, err := g.Move(0); err != nil {
		t.Fatalf("first move on empty cell failed: %v", err)
	}

	board, current, status, err := g.Move(0)
	if !errors.Is(err, ErrIllegalMove) {
		t.Fatalf("Move on occupied cell error = %v, want ErrIllegalMove", err)
	}
	if board[0] != X {
		t.Errorf("occupied cell was overwritten: got %c", board[0])
	}
	if current != O {
		t.Errorf("current should still belong to the player who was rejected: got %c", current)
	}
	if status != StatusInProgress {
		t.Errorf("status changed after a rejected move: got %q", status)
	}
}

func TestGameMoveRejectsOutOfRangeCell(t *testing.T) {
	g := NewGame()
	if _, _, _, err := g.Move(9); !errors.Is(err, ErrIllegalMove) {
		t.Errorf("Move(9) error = %v, want ErrIllegalMove", err)
	}
	if _, _, _, err := g.Move(-1); !errors.Is(err, ErrIllegalMove) {
		t.Errorf("Move(-1) error = %v, want ErrIllegalMove", err)
	}
}

func TestGameMoveDetectsWin(t *testing.T) {
	g := NewGame()
	// X: 0,1,2 (top row); O: 3,4.
	moves := []int{0, 3, 1, 4, 2}
	var (
		board  Board
		status Status
		err    error
	)
	for _, cell := range moves {
		board, _, status, err = g.Move(cell)
		if err != nil {
			t.Fatalf("Move(%d) returned error: %v", cell, err)
		}
	}

	if status != StatusXWon {
		t.Fatalf("status = %q, want %q", status, StatusXWon)
	}
	if board.Winner() != X {
		t.Errorf("board.Winner() = %c, want %c", board.Winner(), X)
	}
}

func TestGameMoveDetectsDraw(t *testing.T) {
	g := NewGame()
	// X:0,1,5,6,8  O:2,3,4,7 -> full board, no line.
	moves := []int{0, 2, 1, 3, 5, 4, 6, 7, 8}
	var status Status
	var err error
	for _, cell := range moves {
		_, _, status, err = g.Move(cell)
		if err != nil {
			t.Fatalf("Move(%d) returned error: %v", cell, err)
		}
	}

	if status != StatusDraw {
		t.Fatalf("status = %q, want %q", status, StatusDraw)
	}
}

func TestGameMoveAfterGameOverFails(t *testing.T) {
	g := NewGame()
	for _, cell := range []int{0, 3, 1, 4, 2} { // X wins the top row
		if _, _, _, err := g.Move(cell); err != nil {
			t.Fatalf("Move(%d) returned error: %v", cell, err)
		}
	}

	board, _, status, err := g.Move(5)
	if !errors.Is(err, ErrGameOver) {
		t.Fatalf("Move after game over error = %v, want ErrGameOver", err)
	}
	if status != StatusXWon {
		t.Errorf("status changed after a move on a finished game: got %q", status)
	}
	if board[5] != Empty {
		t.Errorf("board changed after a move on a finished game: cell 5 = %c", board[5])
	}
}
