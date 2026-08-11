package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
)

func main() {
	if err := run(os.Stdin, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

// run plays a full game, reading moves from in and writing the board to out.
func run(in io.Reader, out io.Writer) error {
	scanner := bufio.NewScanner(in)
	board := NewBoard()
	current := X

	fmt.Fprintln(out, "Tic-tac-toe: two players, X goes first.")
	fmt.Fprintln(out, "Pick a cell by typing its number 1-9, or 'q' to quit.")

	for {
		fmt.Fprintf(out, "\n%s\n", board)

		cell, quit, err := readMove(scanner, out, board, current)
		if err != nil {
			return err
		}
		if quit {
			fmt.Fprintln(out, "Game abandoned.")
			return nil
		}

		board.Play(cell, current)

		if w := board.Winner(); w != Empty {
			fmt.Fprintf(out, "\n%s\nPlayer %c wins!\n", board, w)
			return nil
		}
		if board.Full() {
			fmt.Fprintf(out, "\n%s\nIt's a draw.\n", board)
			return nil
		}

		current = other(current)
	}
}

// readMove prompts player until it gets a legal, unoccupied cell index. It
// returns quit=true if the player asked to stop or input ran out.
func readMove(scanner *bufio.Scanner, out io.Writer, board *Board, player Mark) (cell int, quit bool, err error) {
	for {
		fmt.Fprintf(out, "Player %c, your move: ", player)

		if !scanner.Scan() {
			if err := scanner.Err(); err != nil {
				return 0, false, err
			}
			fmt.Fprintln(out)
			return 0, true, nil
		}

		input := strings.TrimSpace(scanner.Text())
		if input == "q" || input == "quit" {
			return 0, true, nil
		}

		n, convErr := strconv.Atoi(input)
		if convErr != nil || n < 1 || n > 9 {
			fmt.Fprintln(out, "Please enter a number from 1 to 9.")
			continue
		}
		if board[n-1] != Empty {
			fmt.Fprintf(out, "Cell %d is already taken.\n", n)
			continue
		}
		return n - 1, false, nil
	}
}

// other returns the mark belonging to the opposing player.
func other(m Mark) Mark {
	if m == X {
		return O
	}
	return X
}
