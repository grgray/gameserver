package game

// Level selects how strong the computer opponent plays.
type Level int

const (
	// Level1 is the easy opponent. It takes an immediate win and blocks an
	// immediate loss, but otherwise plays the first empty cell, so it never
	// spots a fork and a human who sets up a move threatening two lines will
	// beat it.
	Level1 Level = 1
	// Level2 is the unbeatable opponent. It plays optimally with minimax and
	// therefore never loses: every game ends in a win for it or a draw.
	Level2 Level = 2
)

// ChooseMove returns the cell (0-8) the computer should play for mark on
// board, according to the given level. It assumes board has at least one
// empty cell; if it does not, it returns -1.
func ChooseMove(board Board, mark Mark, level Level) int {
	if level == Level2 {
		return bestMove(board, mark)
	}
	return easyMove(board, mark)
}

// easyMove takes an immediate win or blocks an immediate loss, otherwise it
// plays the first empty cell. It does not look ahead, so it fails to
// prevent a fork.
func easyMove(board Board, mark Mark) int {
	if cell, ok := winningMove(board, mark); ok {
		return cell
	}
	if cell, ok := winningMove(board, other(mark)); ok {
		return cell
	}
	for cell, m := range board {
		if m == Empty {
			return cell
		}
	}
	return -1
}

// winningMove reports a cell where playing mark would complete a line, if
// one exists.
func winningMove(board Board, mark Mark) (int, bool) {
	for _, line := range winningLines {
		empty := -1
		count := 0
		for _, cell := range line {
			switch board[cell] {
			case mark:
				count++
			case Empty:
				empty = cell
			}
		}
		if count == 2 && empty != -1 {
			return empty, true
		}
	}
	return 0, false
}

// bestMove returns the minimax-optimal cell for mark. A win scores +1, a
// draw 0 and a loss -1; ties are broken toward the lowest cell index so the
// result is deterministic.
func bestMove(board Board, mark Mark) int {
	best, bestScore := -1, -2
	for cell, m := range board {
		if m != Empty {
			continue
		}
		board[cell] = mark
		score := -minimax(board, other(mark))
		board[cell] = Empty
		if score > bestScore {
			best, bestScore = cell, score
		}
	}
	return best
}

// minimax returns the score for the player whose turn it is to move on the
// given board: +1 for a win, 0 for a draw, -1 for a loss, assuming both
// sides play optimally.
func minimax(board Board, player Mark) int {
	if board.Winner() != Empty {
		// The game ended on the previous move, so the player to move loses.
		return -1
	}
	if board.Full() {
		return 0
	}

	best := -2
	for cell, m := range board {
		if m != Empty {
			continue
		}
		board[cell] = player
		score := -minimax(board, other(player))
		board[cell] = Empty
		if score > best {
			best = score
		}
	}
	return best
}
