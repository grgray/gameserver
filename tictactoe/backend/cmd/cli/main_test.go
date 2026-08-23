package main

import (
	"strings"
	"testing"
)

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
