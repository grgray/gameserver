package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"

	"github.com/readfern-gray/tictactoe/internal/game"
)

// Mode describes who the human player faces.
type Mode string

const (
	ModeHuman    Mode = "human"
	ModeComputer Mode = "computer"
)

// Match is a game plus the context needed to serve it over the API: whether
// it is human-vs-human or human-vs-computer and, for the latter, how strong
// the computer plays and which mark the human holds.
type Match struct {
	game      *game.Game
	mode      Mode
	level     game.Level
	humanMark game.Mark
}

// isComputer reports whether this match is played against the computer.
func (m *Match) isComputer() bool { return m.mode == ModeComputer }

// computerMark returns the mark the computer plays.
func (m *Match) computerMark() game.Mark {
	return other(m.humanMark)
}

// playComputer makes the computer's next move if it is the computer's turn
// and the game is still in progress.
func (m *Match) playComputer() {
	board, current, status := m.game.State()
	if status != game.StatusInProgress || current != m.computerMark() {
		return
	}
	cell := game.ChooseMove(board, current, m.level)
	m.game.Move(cell)
}

// other returns the mark belonging to the opposing player.
func other(m game.Mark) game.Mark {
	if m == game.X {
		return game.O
	}
	return game.X
}

// GameStore holds in-progress matches in memory, keyed by ID, so the REST
// API can serve concurrent games to concurrent clients.
type GameStore struct {
	mu    sync.Mutex
	games map[string]*Match
}

// NewGameStore returns an empty store.
func NewGameStore() *GameStore {
	return &GameStore{games: make(map[string]*Match)}
}

// Create starts a new human-vs-human game, stores it under a fresh ID and
// returns both.
func (s *GameStore) Create() (id string, m *Match) {
	id = newGameID()
	m = &Match{game: game.NewGame(), mode: ModeHuman}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.games[id] = m
	return id, m
}

// CreateComputer starts a new human-vs-computer game. The human plays
// humanMark; the computer plays the other mark at the given level. X always
// moves first, so a human playing O watches the computer open.
func (s *GameStore) CreateComputer(level game.Level, humanMark game.Mark) (id string, m *Match) {
	id = newGameID()
	m = &Match{game: game.NewGame(), mode: ModeComputer, level: level, humanMark: humanMark}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.games[id] = m
	m.playComputer()
	return id, m
}

// Get looks up a match by ID.
func (s *GameStore) Get(id string) (m *Match, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	m, ok = s.games[id]
	return m, ok
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
// fetched or after a move. Mode, Level and Mark are present only for games
// against the computer.
type stateResponse struct {
	ID     string    `json:"id"`
	Board  [9]string `json:"board"`
	Turn   string    `json:"turn,omitempty"`
	Status string    `json:"status"`
	Winner string    `json:"winner,omitempty"`
	Mode   string    `json:"mode,omitempty"`
	Level  int       `json:"level,omitempty"`
	Mark   string    `json:"mark,omitempty"`
}

// moveRequest is the JSON body expected by POST /games/{id}/moves.
type moveRequest struct {
	Cell int `json:"cell"`
}

// createRequest is the optional JSON body accepted by POST /games. An
// absent or empty body, or Mode "human", starts a two-human game; Mode
// "computer" starts a game against the computer at the given level with the
// human playing mark.
type createRequest struct {
	Mode  string `json:"mode"`
	Level int    `json:"level"`
	Mark  string `json:"mark"`
}

func (s *Server) handleCreate(w http.ResponseWriter, r *http.Request) {
	req, err := decodeCreate(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	switch Mode(req.Mode) {
	case "", ModeHuman:
		id, m := s.store.Create()
		writeMatch(w, http.StatusCreated, id, m)
	case ModeComputer:
		level, err := parseLevel(req.Level)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		mark, err := parseMark(req.Mark)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		id, m := s.store.CreateComputer(level, mark)
		writeMatch(w, http.StatusCreated, id, m)
	default:
		writeError(w, http.StatusBadRequest, `mode must be "human" or "computer"`)
	}
}

func (s *Server) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	m, ok := s.store.Get(id)
	if !ok {
		writeError(w, http.StatusNotFound, "game not found")
		return
	}

	writeMatch(w, http.StatusOK, id, m)
}

func (s *Server) handleMove(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	m, ok := s.store.Get(id)
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

	if m.isComputer() {
		_, current, status := m.game.State()
		if status != game.StatusInProgress {
			writeError(w, http.StatusConflict, "game is already over")
			return
		}
		if current != m.humanMark {
			writeError(w, http.StatusConflict, "not your turn")
			return
		}
	}

	_, _, status, err := m.game.Move(req.Cell - 1)
	switch {
	case errors.Is(err, game.ErrGameOver):
		writeError(w, http.StatusConflict, "game is already over")
		return
	case errors.Is(err, game.ErrIllegalMove):
		writeError(w, http.StatusConflict, fmt.Sprintf("cell %d is already taken", req.Cell))
		return
	}

	// In computer mode the computer answers immediately, so the response
	// already reflects both the human's move and the computer's reply.
	if m.isComputer() && status == game.StatusInProgress {
		m.playComputer()
	}

	writeMatch(w, http.StatusOK, id, m)
}

// decodeCreate reads the optional POST /games body. An empty body is treated
// as a human-vs-human game.
func decodeCreate(r *http.Request) (createRequest, error) {
	if r.Body == nil {
		return createRequest{}, nil
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	var req createRequest
	if err := dec.Decode(&req); err != nil {
		if errors.Is(err, io.EOF) {
			return createRequest{}, nil
		}
		return createRequest{}, errors.New(`body must be JSON like {"mode":"computer","level":2,"mark":"O"}`)
	}
	return req, nil
}

// parseLevel validates a requested computer difficulty.
func parseLevel(n int) (game.Level, error) {
	switch n {
	case int(game.Level1):
		return game.Level1, nil
	case int(game.Level2):
		return game.Level2, nil
	}
	return 0, errors.New("level must be 1 or 2")
}

// parseMark validates the human's chosen mark, defaulting to X when empty.
func parseMark(s string) (game.Mark, error) {
	switch s {
	case "", "X":
		return game.X, nil
	case "O":
		return game.O, nil
	}
	return game.Empty, errors.New(`mark must be "X" or "O"`)
}

// writeMatch writes a match snapshot as JSON. turn is included only while
// the game is still in progress; winner only once it is won; mode, level and
// mark only for games against the computer.
func writeMatch(w http.ResponseWriter, code int, id string, m *Match) {
	board, current, status := m.game.State()

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
	if m.isComputer() {
		resp.Mode = string(m.mode)
		resp.Level = int(m.level)
		resp.Mark = markString(m.humanMark)
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
