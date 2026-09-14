package gameengine

import "math"

type CellState int

const (
	Empty CellState = iota
	Black
	White
)

const boardSize = 8

type Board [boardSize][boardSize]CellState

type Difficulty int

const (
	Easy   Difficulty = iota
	Medium            // minimax depth 3
	Hard              // minimax depth 5
)

type Game struct {
	Board              Board      `json:"board"`
	CurrentPlayer      CellState  `json:"currentPlayer"`
	Difficulty         Difficulty `json:"difficulty"`
	PlayAgainstComputer bool      `json:"playAgainstComputer"`
	ComputerPlayer     CellState  `json:"computerPlayer"`
	GameOver           bool       `json:"gameOver"`
}

func NewGame(difficulty Difficulty, playAgainstComputer bool) *Game {
	g := &Game{
		CurrentPlayer:       Black,
		Difficulty:          difficulty,
		PlayAgainstComputer: playAgainstComputer,
		ComputerPlayer:      White,
	}
	g.Board[3][3] = White
	g.Board[3][4] = Black
	g.Board[4][3] = Black
	g.Board[4][4] = White
	return g
}

func opponent(player CellState) CellState {
	if player == Black {
		return White
	}
	return Black
}

func (g *Game) Opponent() CellState {
	return opponent(g.CurrentPlayer)
}

func (g *Game) IsValidMove(row, col int) bool {
	return isValidMoveOnBoard(row, col, g.CurrentPlayer, g.Board)
}

func isValidMoveOnBoard(row, col int, player CellState, board Board) bool {
	if board[row][col] != Empty {
		return false
	}
	for dRow := -1; dRow <= 1; dRow++ {
		for dCol := -1; dCol <= 1; dCol++ {
			if dRow == 0 && dCol == 0 {
				continue
			}
			if canFlipInDirection(row, col, dRow, dCol, player, board) {
				return true
			}
		}
	}
	return false
}

func canFlipInDirection(row, col, dRow, dCol int, player CellState, board Board) bool {
	opp := opponent(player)
	r, c := row+dRow, col+dCol
	foundOpponent := false

	for r >= 0 && r < boardSize && c >= 0 && c < boardSize {
		switch board[r][c] {
		case Empty:
			return false
		case opp:
			foundOpponent = true
		case player:
			return foundOpponent
		}
		r += dRow
		c += dCol
	}
	return false
}

func (g *Game) ValidMoves() [][2]int {
	return validMovesOnBoard(g.CurrentPlayer, g.Board)
}

func validMovesOnBoard(player CellState, board Board) [][2]int {
	var moves [][2]int
	for row := 0; row < boardSize; row++ {
		for col := 0; col < boardSize; col++ {
			if isValidMoveOnBoard(row, col, player, board) {
				moves = append(moves, [2]int{row, col})
			}
		}
	}
	return moves
}

func hasValidMovesOnBoard(player CellState, board Board) bool {
	for row := 0; row < boardSize; row++ {
		for col := 0; col < boardSize; col++ {
			if board[row][col] == Empty && isValidMoveOnBoard(row, col, player, board) {
				return true
			}
		}
	}
	return false
}

func (g *Game) HasValidMoves(player CellState) bool {
	return hasValidMovesOnBoard(player, g.Board)
}

// MakeMove places a piece for the current player and flips captured pieces.
// It does not advance the turn — call AdvanceTurn after.
func (g *Game) MakeMove(row, col int) {
	makeMoveOnBoard(row, col, g.CurrentPlayer, &g.Board)
}

func makeMoveOnBoard(row, col int, player CellState, board *Board) {
	board[row][col] = player
	for dRow := -1; dRow <= 1; dRow++ {
		for dCol := -1; dCol <= 1; dCol++ {
			if dRow == 0 && dCol == 0 {
				continue
			}
			if canFlipInDirection(row, col, dRow, dCol, player, *board) {
				flipInDirection(row, col, dRow, dCol, player, board)
			}
		}
	}
}

func flipInDirection(row, col, dRow, dCol int, player CellState, board *Board) {
	r, c := row+dRow, col+dCol
	for r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] != player {
		board[r][c] = player
		r += dRow
		c += dCol
	}
}

// CountFlippedPieces returns how many opponent pieces would be flipped by placing
// the current player's piece at (row, col).
func (g *Game) CountFlippedPieces(row, col int) int {
	total := 0
	for dRow := -1; dRow <= 1; dRow++ {
		for dCol := -1; dCol <= 1; dCol++ {
			if dRow == 0 && dCol == 0 {
				continue
			}
			if canFlipInDirection(row, col, dRow, dCol, g.CurrentPlayer, g.Board) {
				total += countPiecesInDirection(row, col, dRow, dCol, g.CurrentPlayer, g.Board)
			}
		}
	}
	return total
}

func countPiecesInDirection(row, col, dRow, dCol int, player CellState, board Board) int {
	opp := opponent(player)
	count := 0
	r, c := row+dRow, col+dCol
	for r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] == opp {
		count++
		r += dRow
		c += dCol
	}
	return count
}

// AdvanceTurn switches to the opponent. If the opponent has no moves the current
// player moves again. If neither player has moves the game is over.
// Returns whether the game is now over.
func (g *Game) AdvanceTurn() bool {
	next := opponent(g.CurrentPlayer)
	if hasValidMovesOnBoard(next, g.Board) {
		g.CurrentPlayer = next
		return false
	}
	// Opponent has no moves — current player keeps their turn.
	if hasValidMovesOnBoard(g.CurrentPlayer, g.Board) {
		// CurrentPlayer stays the same.
		return false
	}
	// Neither player has moves.
	g.GameOver = true
	return true
}

type Score struct {
	Black  int `json:"black"`
	White  int `json:"white"`
	Winner string `json:"winner"` // "Black", "White", or "Tie"
}

func (g *Game) CountPieces() Score {
	return countPiecesOnBoard(g.Board)
}

func countPiecesOnBoard(board Board) Score {
	var s Score
	for row := 0; row < boardSize; row++ {
		for col := 0; col < boardSize; col++ {
			switch board[row][col] {
			case Black:
				s.Black++
			case White:
				s.White++
			}
		}
	}
	switch {
	case s.Black > s.White:
		s.Winner = "Black"
	case s.White > s.Black:
		s.Winner = "White"
	default:
		s.Winner = "Tie"
	}
	return s
}

// ComputerMove returns the best (row, col) for the computer player according
// to the configured difficulty, or (-1, -1) if no moves are available.
func (g *Game) ComputerMove() (int, int) {
	switch g.Difficulty {
	case Easy:
		return g.computerMoveEasy()
	case Hard:
		return g.computerMoveMinimax(5)
	default: // Medium
		return g.computerMoveMinimax(3)
	}
}

// computerMoveEasy picks the move that immediately flips the most pieces.
func (g *Game) computerMoveEasy() (int, int) {
	bestRow, bestCol, bestScore := -1, -1, -1
	for row := 0; row < boardSize; row++ {
		for col := 0; col < boardSize; col++ {
			if isValidMoveOnBoard(row, col, g.CurrentPlayer, g.Board) {
				flipped := g.CountFlippedPieces(row, col)
				if flipped > bestScore {
					bestScore = flipped
					bestRow, bestCol = row, col
				}
			}
		}
	}
	return bestRow, bestCol
}

// computerMoveMinimax picks the best move using alpha-beta minimax at the given depth.
func (g *Game) computerMoveMinimax(depth int) (int, int) {
	bestRow, bestCol, bestScore := -1, -1, math.MinInt32
	for row := 0; row < boardSize; row++ {
		for col := 0; col < boardSize; col++ {
			if isValidMoveOnBoard(row, col, g.CurrentPlayer, g.Board) {
				score := minimax(row, col, depth, g.Board, g.CurrentPlayer, math.MinInt32, math.MaxInt32)
				if score > bestScore {
					bestScore = score
					bestRow, bestCol = row, col
				}
			}
		}
	}
	return bestRow, bestCol
}

func minimax(row, col, depth int, board Board, player CellState, alpha, beta int) int {
	newBoard := board
	makeMoveOnBoard(row, col, player, &newBoard)

	if depth == 0 {
		return evaluateBoard(newBoard, player)
	}

	next := opponent(player)
	if !hasValidMovesOnBoard(next, newBoard) {
		next = player
		if !hasValidMovesOnBoard(next, newBoard) {
			return evaluateBoard(newBoard, player)
		}
	}

	if next == player {
		// Maximising
		maxScore := math.MinInt32
		for r := 0; r < boardSize; r++ {
			for c := 0; c < boardSize; c++ {
				if isValidMoveOnBoard(r, c, next, newBoard) {
					score := minimax(r, c, depth-1, newBoard, next, alpha, beta)
					if score > maxScore {
						maxScore = score
					}
					if maxScore > alpha {
						alpha = maxScore
					}
					if beta <= alpha {
						goto doneMax
					}
				}
			}
		}
	doneMax:
		if maxScore == math.MinInt32 {
			return evaluateBoard(newBoard, player)
		}
		return maxScore
	}

	// Minimising
	minScore := math.MaxInt32
	for r := 0; r < boardSize; r++ {
		for c := 0; c < boardSize; c++ {
			if isValidMoveOnBoard(r, c, next, newBoard) {
				score := minimax(r, c, depth-1, newBoard, next, alpha, beta)
				if score < minScore {
					minScore = score
				}
				if minScore < beta {
					beta = minScore
				}
				if beta <= alpha {
					goto doneMin
				}
			}
		}
	}
doneMin:
	if minScore == math.MaxInt32 {
		return evaluateBoard(newBoard, player)
	}
	return minScore
}

func evaluateBoard(board Board, player CellState) int {
	opp := opponent(player)
	score := 0
	playerPieces, opponentPieces := 0, 0
	playerMobility, opponentMobility := 0, 0

	for row := 0; row < boardSize; row++ {
		for col := 0; col < boardSize; col++ {
			cell := board[row][col]

			if cell == player {
				playerPieces++
			} else if cell == opp {
				opponentPieces++
			}

			isCorner := (row == 0 || row == boardSize-1) && (col == 0 || col == boardSize-1)
			isEdge := row == 0 || row == boardSize-1 || col == 0 || col == boardSize-1
			isXSquare := (row == 1 || row == boardSize-2) && (col == 1 || col == boardSize-2)

			switch {
			case isCorner:
				if cell == player {
					score += 100
				} else if cell == opp {
					score -= 100
				}
			case isEdge:
				if cell == player {
					score += 5
				} else if cell == opp {
					score -= 5
				}
			case isXSquare:
				if cell == player {
					score -= 20
				} else if cell == opp {
					score += 20
				}
			}

			if isValidMoveOnBoard(row, col, player, board) {
				playerMobility++
			}
			if isValidMoveOnBoard(row, col, opp, board) {
				opponentMobility++
			}
		}
	}

	score += playerPieces - opponentPieces
	score += (playerMobility - opponentMobility) * 3
	return score
}
