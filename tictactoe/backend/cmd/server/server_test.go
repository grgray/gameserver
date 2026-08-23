package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/readfern-gray/tictactoe/internal/game"
)

// newTestServer starts a real HTTP server backed by a fresh Server, and
// registers its shutdown with t.Cleanup.
func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	ts := httptest.NewServer(NewServer().Handler())
	t.Cleanup(ts.Close)
	return ts
}

// postJSON sends a JSON POST and decodes the JSON response into out. It
// returns the response status code.
func postJSON(t *testing.T, url string, body, out any) int {
	t.Helper()

	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encoding request body: %v", err)
		}
	}

	resp, err := http.Post(url, "application/json", &buf)
	if err != nil {
		t.Fatalf("POST %s: %v", url, err)
	}
	defer resp.Body.Close()

	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			t.Fatalf("decoding response from %s: %v", url, err)
		}
	}
	return resp.StatusCode
}

func getJSON(t *testing.T, url string, out any) int {
	t.Helper()

	resp, err := http.Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	defer resp.Body.Close()

	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			t.Fatalf("decoding response from %s: %v", url, err)
		}
	}
	return resp.StatusCode
}

func TestServerCreateGame(t *testing.T) {
	ts := newTestServer(t)

	var got stateResponse
	code := postJSON(t, ts.URL+"/games", nil, &got)

	if code != http.StatusCreated {
		t.Fatalf("status = %d, want %d", code, http.StatusCreated)
	}
	if got.ID == "" {
		t.Error("created game has no ID")
	}
	if got.Turn != "X" {
		t.Errorf("Turn = %q, want %q", got.Turn, "X")
	}
	if got.Status != string(game.StatusInProgress) {
		t.Errorf("Status = %q, want %q", got.Status, game.StatusInProgress)
	}
	if got.Winner != "" {
		t.Errorf("Winner = %q, want empty", got.Winner)
	}
	for i, cell := range got.Board {
		if cell != "" {
			t.Errorf("Board[%d] = %q, want empty", i, cell)
		}
	}
}

func TestServerGetGame(t *testing.T) {
	ts := newTestServer(t)

	var created stateResponse
	postJSON(t, ts.URL+"/games", nil, &created)

	var got stateResponse
	code := getJSON(t, ts.URL+"/games/"+created.ID, &got)

	if code != http.StatusOK {
		t.Fatalf("status = %d, want %d", code, http.StatusOK)
	}
	if got.ID != created.ID {
		t.Errorf("ID = %q, want %q", got.ID, created.ID)
	}
}

func TestServerGetUnknownGame(t *testing.T) {
	ts := newTestServer(t)

	var got errorResponse
	code := getJSON(t, ts.URL+"/games/does-not-exist", &got)

	if code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", code, http.StatusNotFound)
	}
	if got.Error == "" {
		t.Error("expected an error message")
	}
}

func TestServerMoveSequenceWins(t *testing.T) {
	ts := newTestServer(t)

	var created stateResponse
	postJSON(t, ts.URL+"/games", nil, &created)
	gameURL := ts.URL + "/games/" + created.ID

	// X: 1,2,3 (top row, 1-indexed); O: 4,5.
	moves := []struct {
		cell       int
		wantStatus game.Status
		wantTurn   string
		wantWinner string
	}{
		{1, game.StatusInProgress, "O", ""},
		{4, game.StatusInProgress, "X", ""},
		{2, game.StatusInProgress, "O", ""},
		{5, game.StatusInProgress, "X", ""},
		{3, game.StatusXWon, "", "X"},
	}

	for _, m := range moves {
		var got stateResponse
		code := postJSON(t, gameURL+"/moves", moveRequest{Cell: m.cell}, &got)

		if code != http.StatusOK {
			t.Fatalf("move %d: status = %d, want %d", m.cell, code, http.StatusOK)
		}
		if got.Status != string(m.wantStatus) {
			t.Errorf("move %d: Status = %q, want %q", m.cell, got.Status, m.wantStatus)
		}
		if got.Turn != m.wantTurn {
			t.Errorf("move %d: Turn = %q, want %q", m.cell, got.Turn, m.wantTurn)
		}
		if got.Winner != m.wantWinner {
			t.Errorf("move %d: Winner = %q, want %q", m.cell, got.Winner, m.wantWinner)
		}
	}

	if got := moves[len(moves)-1].wantWinner; got != "X" {
		t.Fatalf("test fixture broken: last move should win for X")
	}
}

func TestServerMoveDraw(t *testing.T) {
	ts := newTestServer(t)

	var created stateResponse
	postJSON(t, ts.URL+"/games", nil, &created)
	gameURL := ts.URL + "/games/" + created.ID

	// Final board (1-indexed cells): X O X / X O O / O X X -> full, no line.
	cells := []int{1, 2, 3, 5, 4, 6, 8, 7, 9}
	var last stateResponse
	for _, cell := range cells {
		last = stateResponse{} // omitempty fields must not leak across decodes
		code := postJSON(t, gameURL+"/moves", moveRequest{Cell: cell}, &last)
		if code != http.StatusOK {
			t.Fatalf("move %d: status = %d, want %d", cell, code, http.StatusOK)
		}
	}

	if last.Status != string(game.StatusDraw) {
		t.Errorf("Status = %q, want %q", last.Status, game.StatusDraw)
	}
	if last.Winner != "" {
		t.Errorf("Winner = %q, want empty", last.Winner)
	}
	if last.Turn != "" {
		t.Errorf("Turn = %q, want empty once the game is over", last.Turn)
	}
}

func TestServerMoveRejectsOccupiedCell(t *testing.T) {
	ts := newTestServer(t)

	var created stateResponse
	postJSON(t, ts.URL+"/games", nil, &created)
	gameURL := ts.URL + "/games/" + created.ID

	var first stateResponse
	if code := postJSON(t, gameURL+"/moves", moveRequest{Cell: 1}, &first); code != http.StatusOK {
		t.Fatalf("first move: status = %d", code)
	}

	var got errorResponse
	code := postJSON(t, gameURL+"/moves", moveRequest{Cell: 1}, &got)
	if code != http.StatusConflict {
		t.Fatalf("status = %d, want %d", code, http.StatusConflict)
	}
	if got.Error == "" {
		t.Error("expected an error message")
	}
}

func TestServerMoveRejectsOutOfRangeCell(t *testing.T) {
	ts := newTestServer(t)

	var created stateResponse
	postJSON(t, ts.URL+"/games", nil, &created)
	gameURL := ts.URL + "/games/" + created.ID

	for _, cell := range []int{0, 10, -1} {
		var got errorResponse
		code := postJSON(t, gameURL+"/moves", moveRequest{Cell: cell}, &got)
		if code != http.StatusBadRequest {
			t.Errorf("cell %d: status = %d, want %d", cell, code, http.StatusBadRequest)
		}
	}
}

func TestServerMoveRejectsMalformedBody(t *testing.T) {
	ts := newTestServer(t)

	var created stateResponse
	postJSON(t, ts.URL+"/games", nil, &created)
	gameURL := ts.URL + "/games/" + created.ID

	resp, err := http.Post(gameURL+"/moves", "application/json", strings.NewReader("not json"))
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func TestServerMoveOnFinishedGameFails(t *testing.T) {
	ts := newTestServer(t)

	var created stateResponse
	postJSON(t, ts.URL+"/games", nil, &created)
	gameURL := ts.URL + "/games/" + created.ID

	for _, cell := range []int{1, 4, 2, 5, 3} { // X wins the top row
		var got stateResponse
		if code := postJSON(t, gameURL+"/moves", moveRequest{Cell: cell}, &got); code != http.StatusOK {
			t.Fatalf("move %d: status = %d", cell, code)
		}
	}

	var got errorResponse
	code := postJSON(t, gameURL+"/moves", moveRequest{Cell: 6}, &got)
	if code != http.StatusConflict {
		t.Fatalf("status = %d, want %d", code, http.StatusConflict)
	}
}

func TestServerMoveUnknownGame(t *testing.T) {
	ts := newTestServer(t)

	var got errorResponse
	code := postJSON(t, ts.URL+"/games/does-not-exist/moves", moveRequest{Cell: 1}, &got)

	if code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", code, http.StatusNotFound)
	}
}

func TestServerCreateComputerGame(t *testing.T) {
	ts := newTestServer(t)

	var got stateResponse
	code := postJSON(t, ts.URL+"/games", createRequest{Mode: "computer", Level: 2, Mark: "O"}, &got)

	if code != http.StatusCreated {
		t.Fatalf("status = %d, want %d", code, http.StatusCreated)
	}
	if got.Mode != "computer" {
		t.Errorf("Mode = %q, want %q", got.Mode, "computer")
	}
	if got.Level != 2 {
		t.Errorf("Level = %d, want 2", got.Level)
	}
	if got.Mark != "O" {
		t.Errorf("Mark = %q, want %q", got.Mark, "O")
	}
	if got.Turn != "O" {
		t.Errorf("Turn = %q, want %q (human O moves after computer X opens)", got.Turn, "O")
	}
	// The computer (X) opens on the top-left corner (lowest tied cell).
	if got.Board[0] != "X" {
		t.Errorf("Board[0] = %q, want %q", got.Board[0], "X")
	}
}

func TestServerCreateComputerDefaultsMarkToX(t *testing.T) {
	ts := newTestServer(t)

	var got stateResponse
	code := postJSON(t, ts.URL+"/games", createRequest{Mode: "computer", Level: 1}, &got)

	if code != http.StatusCreated {
		t.Fatalf("status = %d, want %d", code, http.StatusCreated)
	}
	if got.Mark != "X" {
		t.Errorf("Mark = %q, want %q", got.Mark, "X")
	}
	if got.Turn != "X" {
		t.Errorf("Turn = %q, want %q (human X moves first)", got.Turn, "X")
	}
	for i, cell := range got.Board {
		if cell != "" {
			t.Errorf("Board[%d] = %q, want empty before human X moves", i, cell)
		}
	}
}

func TestServerComputerLevel1HumanWinsByFork(t *testing.T) {
	ts := newTestServer(t)

	var created stateResponse
	postJSON(t, ts.URL+"/games", createRequest{Mode: "computer", Level: 1, Mark: "X"}, &created)
	gameURL := ts.URL + "/games/" + created.ID

	// X: 5 (centre), 9, then 3 creates a fork; 7 completes the win.
	for _, cell := range []int{5, 9, 3, 7} {
		var got stateResponse
		if code := postJSON(t, gameURL+"/moves", moveRequest{Cell: cell}, &got); code != http.StatusOK {
			t.Fatalf("move %d: status = %d, want %d", cell, code, http.StatusOK)
		}
		if cell == 7 {
			if got.Status != string(game.StatusXWon) || got.Winner != "X" {
				t.Fatalf("move %d: status = %q winner = %q, want X win", cell, got.Status, got.Winner)
			}
		}
	}
}

func TestServerComputerLevel2NeverLoses(t *testing.T) {
	ts := newTestServer(t)

	var created stateResponse
	postJSON(t, ts.URL+"/games", createRequest{Mode: "computer", Level: 2, Mark: "O"}, &created)
	gameURL := ts.URL + "/games/" + created.ID

	// The human (O) plays dumb — always the first empty cell — while the
	// computer (X) plays Level 2. The computer must never lose.
	for {
		var state stateResponse
		if code := getJSON(t, gameURL, &state); code != http.StatusOK {
			t.Fatalf("GET: status = %d", code)
		}
		if state.Status != string(game.StatusInProgress) {
			if state.Status == string(game.StatusOWon) {
				t.Fatalf("Level 2 computer lost to a dumb human: status = %q", state.Status)
			}
			return
		}

		cell := firstEmptyCell(state.Board)
		if cell == 0 {
			t.Fatal("game in progress but board has no empty cell")
		}
		var after stateResponse
		if code := postJSON(t, gameURL+"/moves", moveRequest{Cell: cell}, &after); code != http.StatusOK {
			t.Fatalf("move %d: status = %d", cell, code)
		}
	}
}

func TestServerCreateComputerRejectsBadRequests(t *testing.T) {
	ts := newTestServer(t)

	tests := []struct {
		name string
		body createRequest
	}{
		{"bad mode", createRequest{Mode: "robot", Level: 2, Mark: "X"}},
		{"bad level", createRequest{Mode: "computer", Level: 3, Mark: "X"}},
		{"bad mark", createRequest{Mode: "computer", Level: 1, Mark: "Z"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var got errorResponse
			code := postJSON(t, ts.URL+"/games", tt.body, &got)
			if code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d", code, http.StatusBadRequest)
			}
			if got.Error == "" {
				t.Error("expected an error message")
			}
		})
	}
}

// firstEmptyCell returns the 1-indexed position of the first empty cell in a
// rendered board, or 0 if the board is full.
func firstEmptyCell(board [9]string) int {
	for i, c := range board {
		if c == "" {
			return i + 1
		}
	}
	return 0
}
