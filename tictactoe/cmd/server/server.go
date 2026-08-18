package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"

	"github.com/readfern-gray/tictactoe/internal/game"
)

// GameStore holds in-progress games in memory, keyed by ID, so the REST API
// can serve concurrent games to concurrent clients.
type GameStore struct {
	mu    sync.Mutex
	games map[string]*game.Game
}

// NewGameStore returns an empty store.
func NewGameStore() *GameStore {
	return &GameStore{games: make(map[string]*game.Game)}
}

// Create starts a new game, stores it under a fresh ID and returns both.
func (s *GameStore) Create() (id string, g *game.Game) {
	id = newGameID()
	g = game.NewGame()

	s.mu.Lock()
	defer s.mu.Unlock()
	s.games[id] = g
	return id, g
}

// Get looks up a game by ID.
func (s *GameStore) Get(id string) (g *game.Game, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	g, ok = s.games[id]
	return g, ok
}

// newGameID returns a random hex identifier for a new game.
func newGameID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		// The OS entropy source is unavailable; nothing sensible to do but
		// fail loudly, same as the standard library's own uuid-adjacent
		// helpers do in this situation.
		panic("tictactoe: crypto/rand unavailable: " + err.Error())
	}
	return hex.EncodeToString(b[:])
}

// Server exposes a Game store over a REST API.
type Server struct {
	store *GameStore
}

// NewServer returns a Server backed by a fresh, empty GameStore.
func NewServer() *Server {
	return &Server{store: NewGameStore()}
}

// Handler returns the Server's routes as an http.Handler.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /games", s.handleCreate)
	mux.HandleFunc("GET /games/{id}", s.handleGet)
	mux.HandleFunc("POST /games/{id}/moves", s.handleMove)
	return mux
}

// ListenAndServe starts the REST API on addr. It blocks until the server
// stops, same as http.ListenAndServe.
func ListenAndServe(addr string) error {
	return http.ListenAndServe(addr, NewServer().Handler())
}

// stateResponse is the JSON shape returned for a game, whether just created,
// fetched or after a move.
type stateResponse struct {
	ID     string    `json:"id"`
	Board  [9]string `json:"board"`
	Turn   string    `json:"turn,omitempty"`
	Status string    `json:"status"`
	Winner string    `json:"winner,omitempty"`
}

// moveRequest is the JSON body expected by POST /games/{id}/moves.
type moveRequest struct {
	Cell int `json:"cell"`
}

func (s *Server) handleCreate(w http.ResponseWriter, r *http.Request) {
	id, g := s.store.Create()
	board, current, status := g.State()
	writeState(w, http.StatusCreated, id, board, current, status)
}

func (s *Server) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	g, ok := s.store.Get(id)
	if !ok {
		writeError(w, http.StatusNotFound, "game not found")
		return
	}

	board, current, status := g.State()
	writeState(w, http.StatusOK, id, board, current, status)
}

func (s *Server) handleMove(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	g, ok := s.store.Get(id)
	if !ok {
		writeError(w, http.StatusNotFound, "game not found")
		return
	}

	var req moveRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, `body must be JSON like {"cell": 1}`)
		return
	}
	if req.Cell < 1 || req.Cell > 9 {
		writeError(w, http.StatusBadRequest, "cell must be between 1 and 9")
		return
	}

	board, current, status, err := g.Move(req.Cell - 1)
	switch {
	case errors.Is(err, game.ErrGameOver):
		writeError(w, http.StatusConflict, "game is already over")
		return
	case errors.Is(err, game.ErrIllegalMove):
		writeError(w, http.StatusConflict, fmt.Sprintf("cell %d is already taken", req.Cell))
		return
	}

	writeState(w, http.StatusOK, id, board, current, status)
}

// writeState writes a game snapshot as JSON. turn is included only while
// the game is still in progress; winner is included only once it is won.
func writeState(w http.ResponseWriter, code int, id string, board game.Board, current game.Mark, status game.Status) {
	resp := stateResponse{
		ID:     id,
		Board:  boardCells(board),
		Status: string(status),
	}
	if status == game.StatusInProgress {
		resp.Turn = markString(current)
	}
	if status == game.StatusXWon || status == game.StatusOWon {
		// Move leaves current as the mark that just moved when that move
		// won, since there is no next player to hand the turn to.
		resp.Winner = markString(current)
	}
	writeJSON(w, code, resp)
}

// errorResponse is the JSON shape returned for failed requests.
type errorResponse struct {
	Error string `json:"error"`
}

func writeError(w http.ResponseWriter, code int, message string) {
	writeJSON(w, code, errorResponse{Error: message})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

// boardCells renders a board as JSON-friendly cell strings: "X", "O" or ""
// for empty, in row-major order.
func boardCells(b game.Board) [9]string {
	var cells [9]string
	for i, m := range b {
		cells[i] = markString(m)
	}
	return cells
}

// markString renders a Mark as the string an API client should see: "X",
// "O", or "" for Empty.
func markString(m game.Mark) string {
	if m == game.Empty {
		return ""
	}
	return string(rune(m))
}
