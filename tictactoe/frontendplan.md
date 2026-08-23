# Plan: React frontend for tic-tac-toe REST API

## Goal
Add an accessible, attractive React (TypeScript) frontend that plays
tic-tac-toe by driving the existing Go REST API, and reorganise the module
into `backend/` (Go) and `frontend/` (React) so the two languages never share
a folder.

## Decisions (confirmed)
- **Layout**: `tictactoe/backend/` (all Go) + `tictactoe/frontend/` (all
  React/TS).
- **Language**: TypeScript via Vite (`react-ts` template).
- **Connectivity**: Vite dev proxy (`/games` → `http://localhost:8080`) for
  development; the Go server also serves the built `frontend/dist` for
  production (single origin, no CORS required).
- **Module path**: keep `github.com/readfern-gray/tictactoe` unchanged (it is
  just an identifier) so all Go import paths stay valid after the move — zero
  import churn.

## 1. Reorganise into `backend/` and `frontend/`
Move (via `git mv` to preserve history):
```
tictactoe/
  go.mod                      -> backend/go.mod
  internal/game/*             -> backend/internal/game/*
  cmd/cli/*                   -> backend/cmd/cli/*
  cmd/server/*                -> backend/cmd/server/*
  Dockerfile.server           -> consolidated at tictactoe/ root (§5)
  cmd/cli/Dockerfile          -> removed (consolidated)
  cmd/server/Dockerfile       -> removed (consolidated)
  docker-compose.yml          -> updated (§5)
  frontend/                    (new, see §3)
```
- `go.mod` keeps module path `github.com/readfern-gray/tictactoe` → no import
  edits in `.go` files.

## 2. Backend changes — serve the built frontend
Add optional static serving to `backend/cmd/server` so the compiled frontend
is reachable at `/`:
- Add a `-static <dir>` flag in `main.go` (empty = API only, current
  behaviour).
- In `server.go`, when `-static` is set, serve static files and an
  `index.html` fallback for `/` (and any non-API route) so the SPA loads.
  API routes (`POST /games`, `GET /games/{id}`,
  `POST /games/{id}/moves`) take precedence — register them first; the static
  handler is the catch-all.
- Keep the JSON API unchanged; no CORS middleware needed (same origin in
  production, proxy in dev).
- Add a test: static mode serves `index.html` at `/` while `/games` still
  returns JSON.

## 3. Frontend — React + TypeScript (Vite)
Scaffold `frontend/` with the Vite `react-ts` template, then add:
```
frontend/
  package.json          # scripts: dev, build, preview, test, lint
  vite.config.ts        # server.proxy: '/games' -> 'http://localhost:8080'
  tsconfig*.json
  index.html            # lang="en", <title>, <meta description>
  src/
    main.tsx
    App.tsx             # top-level state machine + layout
    types.ts            # GameState, Mode, Mark, Level, Status
    api.ts              # typed client: createGame/getGame/move, error mapping
    components/
      NewGameForm.tsx   # mode (2-player/computer), level 1|2, mark X|O
      Board.tsx         # 3x3 grid, a11y grid semantics
      Cell.tsx          # single playable button
      StatusPanel.tsx   # aria-live status/announcements
    App.css             # visual styling
  src/*.test.ts(x)      # Vitest + Testing Library (+ jest-axe)
```

**API client** (`api.ts`) mirrors the server contract:
- `createGame({mode?, level?, mark?})` → `POST /games` (empty body for human;
  `{mode:"computer",level,mark}` otherwise).
- `getGame(id)` → `GET /games/{id}`.
- `move(id, cell /*1-9*/)` → `POST /games/{id}/moves`.
- `types.ts` matches `stateResponse`:
  `{id, board: (""|"X"|"O")[], turn?, status, winner?, mode?, level?, mark?}`
  with `status` union `in_progress|x_won|o_won|draw`.

**Game flow** (App):
1. `NewGameForm` → `createGame` → store `GameState` + `id`.
2. Render `board` (indices 0–8 = cells 1–9) in `Board`.
3. Click an empty cell while `status === "in_progress"` and (in computer mode)
   `turn === mark` → `move(id, cell)` → replace state with the response
   (already includes the computer's reply).
4. `StatusPanel` shows whose turn it is, or the result; button "New game"
   resets.

## 4. Accessibility (screen-reader friendly) + visual design
**Semantics & keyboard:**
- Cells are real `<button>` elements (natively focusable, Enter/Space
  operable).
- Board container uses `role="group"` with `aria-labelledby` pointing at a
  heading ("Game board").
- Each cell's `aria-label` states position and content, e.g.
  `"Row 1, column 1, empty"` / `"…, X"`. Empty cells also expose "Move here"
  intent.
- Occupied cells use `aria-disabled="true"` (not the `disabled` attribute,
  which would remove them from the tab order and hide their content from
  screen-reader users); click handlers guard against replay. They remain
  focusable so users can hear what each square holds.
- Board uses a CSS grid of labelled buttons rather than `role="grid"` (better
  screen-reader behaviour); verified with jest-axe.

**Live announcements:**
- `StatusPanel` uses `role="status"` / `aria-live="polite"` so turn changes
  and the computer's move are announced without stealing focus; game-over
  result uses `aria-live="assertive"`.
- Announce text is updated once per state change (avoid repeating on
  re-render).

**Forms:** `NewGameForm` uses a `<fieldset>` with `<legend>`, a labelled radio
group for mode and mark, and a labelled `<select>` for level (1 easy /
2 unbeatable).

**Visual (attractive, non-colour-reliant):**
- CSS Grid board, generous cell size, clear X/O glyphs styled distinctly
  (X/O are letters, so inherently distinguishable), visible focus ring,
  ≥4.5:1 contrast, responsive layout.
- Winning line highlighted with colour **and** an outline/strike (never colour
  alone).
- Subtle hover/active states; honour `prefers-reduced-motion`.

## 5. Docker & CI
- Consolidate Dockerfiles at the `tictactoe/` root (build context spans both
  `backend/` and `frontend/`):
  - `Dockerfile.server` — multi-stage: node stage builds `frontend/dist`, Go
    stage builds `backend/cmd/server` and copies `dist` in; entrypoint
    `./app -http=:8080 -static=/app/dist`.
  - `Dockerfile.cli` — Go stage builds `backend/cmd/cli`.
  - Remove `cmd/cli/Dockerfile` and `cmd/server/Dockerfile`.
- **docker-compose.yml**: `server` builds the combined image; `cli` service
  references `Dockerfile.cli`.
- **`.github/workflows/tictactoe.yaml`**:
  - Change `working-directory` for `go test` to `tictactoe/backend`.
  - Add steps: `npm ci` + `npm run build` + `npm test` in `tictactoe/frontend`.
  - Update docker build contexts/paths to the new locations.

## 6. Documentation
- Update `tictactoe/README.md`: new `backend/`/`frontend/` layout, frontend
  dev (`npm install`, `npm run dev` → http://localhost:5173 proxied to :8080),
  production build (`npm run build` + server `-static`), accessibility notes.
- Update repo-root `README.md` component table/layout diagram.

## 7. Verification
- Backend: `cd backend && go test ./... && go vet ./... && gofmt -l .`
- Frontend: `cd frontend && npm run build && npm test && npm run lint`
- Manual: run `go run ./cmd/server` (backend) + `npm run dev` (frontend);
  play human-vs-human and human-vs-computer games; run jest-axe / keyboard-only
  pass to confirm screen-reader + keyboard usability.

## Notes
- `plan.md` (previous feature plan) stays for history; this file is the
  frontend plan.
- Frontend tests use Vitest + Testing Library + jest-axe (dev dependencies) to
  honour the repo's "ship with tests" convention.
