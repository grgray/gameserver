package main

import (
	"strings"
	"testing"
)

func TestPlayRejectsBadCells(t *testing.T) {
	b := NewBoard()
	if !b.Play(0, X) {
		t.Fatal("first move on empty cell should succeed")
	}
	if b.Play(0, O) {
		t.Error("playing an occupied cell should fail")
	}
	if b[0] != X {
		t.Errorf("occupied cell was overwritten: got %c", b[0])
	}
	if b.Play(9, O) || b.Play(-1, O) {
		t.Error("out-of-range cells should fail")
	}
}

func TestWinner(t *testing.T) {
	tests := []struct {
		name  string
		moves []int // cells for X, O, X, ... in order
		want  Mark
	}{
		{"empty board", nil, Empty},
		{"top row X", []int{0, 3, 1, 4, 2}, X},
		{"left column O", []int{1, 0, 2, 3, 8, 6}, O},
		{"diagonal X", []int{0, 1, 4, 2, 8}, X},
		{"anti-diagonal X", []int{2, 0, 4, 1, 6}, X},
		{"in progress", []int{0, 4}, Empty},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := NewBoard()
			mark := X
			for _, cell := range tt.moves {
				if !b.Play(cell, mark) {
					t.Fatalf("illegal move %d in fixture", cell)
				}
				mark = other(mark)
			}
			if got := b.Winner(); got != tt.want {
				t.Errorf("Winner() = %c, want %c", got, tt.want)
			}
		})
	}
}

func TestFull(t *testing.T) {
	b := NewBoard()
	if b.Full() {
		t.Error("new board reported full")
	}
	for i := range 9 {
		b.Play(i, X)
	}
	if !b.Full() {
		t.Error("filled board not reported full")
	}
}

func TestStringShowsCellNumbersAndMarks(t *testing.T) {
	b := NewBoard()
	b.Play(4, X)
	out := b.String()
	if !strings.Contains(out, "X") {
		t.Errorf("played mark missing from render:\n%s", out)
	}
	if strings.Contains(out, "5") {
		t.Errorf("cell 5 is occupied but its number is still shown:\n%s", out)
	}
	for _, n := range []string{"1", "2", "3", "4", "6", "7", "8", "9"} {
		if !strings.Contains(out, n) {
			t.Errorf("empty cell %s missing from render:\n%s", n, out)
		}
	}
}

func TestRunPlaysGameToWin(t *testing.T) {
	// X takes the top row; O answers in the middle row.
	in := strings.NewReader("1\n4\n2\n5\n3\n")
	var out strings.Builder

	if err := run(in, &out); err != nil {
		t.Fatalf("run() returned error: %v", err)
	}
	if !strings.Contains(out.String(), "Player X wins!") {
		t.Errorf("expected X to win, got:\n%s", out.String())
	}
}

func TestRunRepromptsOnInvalidInput(t *testing.T) {
	// "banana", out-of-range 42 and the taken cell 1 must all be rejected.
	in := strings.NewReader("1\nbanana\n42\n1\n4\n2\n5\n3\n")
	var out strings.Builder

	if err := run(in, &out); err != nil {
		t.Fatalf("run() returned error: %v", err)
	}
	got := out.String()
	if !strings.Contains(got, "Please enter a number from 1 to 9.") {
		t.Errorf("no complaint about junk input:\n%s", got)
	}
	if !strings.Contains(got, "Cell 1 is already taken.") {
		t.Errorf("no complaint about occupied cell:\n%s", got)
	}
	if !strings.Contains(got, "Player X wins!") {
		t.Errorf("game did not finish after recovering from bad input:\n%s", got)
	}
}

func TestRunDraw(t *testing.T) {
	// X:1,2,6,7,8  O:3,4,5,9 -> full board, no line.
	in := strings.NewReader("1\n2\n5\n3\n6\n4\n8\n9\n7\n")
	var out strings.Builder

	if err := run(in, &out); err != nil {
		t.Fatalf("run() returned error: %v", err)
	}
	if !strings.Contains(out.String(), "It's a draw.") {
		t.Errorf("expected a draw, got:\n%s", out.String())
	}
}

func TestRunQuit(t *testing.T) {
	var out strings.Builder
	if err := run(strings.NewReader("q\n"), &out); err != nil {
		t.Fatalf("run() returned error: %v", err)
	}
	if !strings.Contains(out.String(), "Game abandoned.") {
		t.Errorf("quit not honoured:\n%s", out.String())
	}
}
