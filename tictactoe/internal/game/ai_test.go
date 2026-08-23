package game

import "testing"

// boardWith returns a board populated with the given cell->mark entries.
func boardWith(marks map[int]Mark) Board {
	b := *NewBoard()
	for cell, m := range marks {
		b[cell] = m
	}
	return b
}

func TestEasyMoveTakesWin(t *testing.T) {
	b := boardWith(map[int]Mark{0: X, 1: X, 3: O, 4: O})
	if got := ChooseMove(b, X, Level1); got != 2 {
		t.Errorf("ChooseMove = %d, want 2", got)
	}
}

func TestEasyMoveBlocksWin(t *testing.T) {
	b := boardWith(map[int]Mark{0: X, 1: X})
	if got := ChooseMove(b, O, Level1); got != 2 {
		t.Errorf("ChooseMove = %d, want 2 (block X's top row)", got)
	}
}

func TestEasyMovePicksFirstEmpty(t *testing.T) {
	b := boardWith(map[int]Mark{4: X})
	if got := ChooseMove(b, O, Level1); got != 0 {
		t.Errorf("ChooseMove = %d, want 0", got)
	}
}

func TestLevel1AllowsFork(t *testing.T) {
	// O in the top-left, X in the centre and bottom-right, O to move. The
	// only drawing replies are the corners (2, 6); an edge lets X fork.
	b := boardWith(map[int]Mark{0: O, 4: X, 8: X})
	if got := ChooseMove(b, O, Level1); got != 1 {
		t.Errorf("ChooseMove = %d, want 1 (an edge, which allows a fork)", got)
	}
}

func TestLevel2BlocksFork(t *testing.T) {
	b := boardWith(map[int]Mark{0: O, 4: X, 8: X})
	got := ChooseMove(b, O, Level2)
	if got != 2 && got != 6 {
		t.Errorf("ChooseMove = %d, want a corner (2 or 6) to block X's fork", got)
	}
}

func TestLevel2TakesWin(t *testing.T) {
	// O to move: O@0,1 wins at 2; any other move lets X complete diag 2-4-6.
	b := boardWith(map[int]Mark{0: O, 1: O, 3: X, 4: X, 6: X, 7: O, 8: X})
	if got := ChooseMove(b, O, Level2); got != 2 {
		t.Errorf("ChooseMove = %d, want 2", got)
	}
}

func TestLevel2VsLevel2Draws(t *testing.T) {
	b := *NewBoard()
	mark := X
	for b.Winner() == Empty && !b.Full() {
		cell := ChooseMove(b, mark, Level2)
		if cell < 0 {
			t.Fatal("ChooseMove returned no move on a non-full board")
		}
		if !b.Play(cell, mark) {
			t.Fatalf("illegal move %d for %c", cell, mark)
		}
		mark = other(mark)
	}
	if w := b.Winner(); w != Empty {
		t.Fatalf("perfect play produced a winner (%c); want a draw", w)
	}
}

func TestLevel2NeverLosesToDumbHuman(t *testing.T) {
	// X is the "human" and always takes the first empty cell; O is Level 2.
	b := *NewBoard()
	mark := X
	for b.Winner() == Empty && !b.Full() {
		var cell int
		if mark == O {
			cell = ChooseMove(b, O, Level2)
		} else {
			cell = firstEmpty(&b)
		}
		if cell < 0 || !b.Play(cell, mark) {
			t.Fatalf("illegal move %d for %c", cell, mark)
		}
		mark = other(mark)
	}
	if w := b.Winner(); w == X {
		t.Fatalf("Level 2 lost to a dumb human (%c won)", w)
	}
}

// firstEmpty returns the lowest empty cell index, or -1 if the board is full.
func firstEmpty(b *Board) int {
	for i, m := range b {
		if m == Empty {
			return i
		}
	}
	return -1
}
