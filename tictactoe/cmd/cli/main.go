package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/readfern-gray/tictactoe/internal/game"
)

func main() {
	if err := run(os.Stdin, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

// run plays a full game, reading moves from in and writing the board to
// out. It drives the same Game engine the REST API uses.
func run(in io.Reader, out io.Writer) error {
	scanner := bufio.NewScanner(in)
	g := game.NewGame()

	fmt.Fprintln(out, "Tic-tac-toe: two players, X goes first.")
	fmt.Fprintln(out, "Pick a cell by typing its number 1-9, or 'q' to quit.")

	for {
		board, current, status := g.State()
		fmt.Fprintf(out, "\n%s\n", &board)

		if status != game.StatusInProgress {
			printResult(out, status)
			return nil
		}

		cell, quit, err := readMove(scanner, out, &board, current)
		if err != nil {
			return err
		}
		if quit {
			fmt.Fprintln(out, "Game abandoned.")
			return nil
		}

		board, _, status, err = g.Move(cell)
		if err != nil {
			// readMove already checked this cell against the board it was
			// shown, so this can't happen outside a race with another
			// caller; loop back and re-show the current state.
			continue
		}
		if status != game.StatusInProgress {
			fmt.Fprintf(out, "\n%s\n", &board)
			printResult(out, status)
			return nil
		}
	}
}

// printResult announces a finished game's outcome.
func printResult(out io.Writer, status game.Status) {
	switch status {
	case game.StatusXWon:
		fmt.Fprintln(out, "Player X wins!")
	case game.StatusOWon:
		fmt.Fprintln(out, "Player O wins!")
	case game.StatusDraw:
		fmt.Fprintln(out, "It's a draw.")
	}
}

// readMove prompts player until it gets a legal, unoccupied cell index. It
// returns quit=true if the player asked to stop or input ran out.
func readMove(scanner *bufio.Scanner, out io.Writer, board *game.Board, player game.Mark) (cell int, quit bool, err error) {
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
		if board[n-1] != game.Empty {
			fmt.Fprintf(out, "Cell %d is already taken.\n", n)
			continue
		}
		return n - 1, false, nil
	}
}
