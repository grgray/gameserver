package game

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
