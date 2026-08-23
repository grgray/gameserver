package game

import "strings"

// Mark is the symbol occupying a cell: Empty, X or O.
type Mark byte

const (
	Empty Mark = ' '
	X     Mark = 'X'
	O     Mark = 'O'
)

// Board holds the nine cells in row-major order, indexed 0-8.
type Board [9]Mark

// NewBoard returns an empty board.
func NewBoard() *Board {
	var b Board
	for i := range b {
		b[i] = Empty
	}
	return &b
}

// winningLines lists every row, column and diagonal as cell indices.
var winningLines = [8][3]int{
	{0, 1, 2}, {3, 4, 5}, {6, 7, 8}, // rows
	{0, 3, 6}, {1, 4, 7}, {2, 5, 8}, // columns
	{0, 4, 8}, {2, 4, 6}, // diagonals
}

// Play puts mark in cell, reporting whether the move was legal.
func (b *Board) Play(cell int, mark Mark) bool {
	if cell < 0 || cell > 8 || b[cell] != Empty {
		return false
	}
	b[cell] = mark
	return true
}

// Winner returns the mark occupying a complete line, or Empty if there is none.
func (b *Board) Winner() Mark {
	for _, line := range winningLines {
		if m := b[line[0]]; m != Empty && m == b[line[1]] && m == b[line[2]] {
			return m
		}
	}
	return Empty
}

// Full reports whether every cell is taken.
func (b *Board) Full() bool {
	for _, m := range b {
		if m == Empty {
			return false
		}
	}
	return true
}

// String renders the board, showing the cell number for empty cells so players
// know what to type.
func (b *Board) String() string {
	var sb strings.Builder
	for row := range 3 {
		sb.WriteString("  ")
		for col := range 3 {
			i := row*3 + col
			if b[i] == Empty {
				sb.WriteByte(byte('1' + i))
			} else {
				sb.WriteByte(byte(b[i]))
			}
			if col < 2 {
				sb.WriteString(" | ")
			}
		}
		sb.WriteByte('\n')
		if row < 2 {
			sb.WriteString(" ---+---+---\n")
		}
	}
	return sb.String()
}
