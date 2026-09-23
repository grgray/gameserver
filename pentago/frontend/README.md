# pentago frontend

React (Vite) web app for Pentago, playing against the FastAPI backend in
`../backend`. Built keyboard- and screen-reader-first, with Dot Pad tactile
display support carried over from CrossMyMind.

## Run

Start the backend first (see `../backend/README.md`), then:

```sh
cd pentago/frontend
npm install
npm run dev          # http://localhost:5173, proxies /games (REST + WebSocket) to :8000
```

## Test, lint, build

```sh
npm test
npm run lint
npm run build
```

## Layout

```
src/
  App.jsx                 top level: lobby or game, live updates, seat restore
  api.js                  REST calls and the per-game WebSocket (auto-reconnects)
  game.js                 board helpers (rotation, five-in-a-row) and wording for announcements
  gameState.js            reducer: server state + pending cell, rotation animation, announcements
  seatStorage.js          remembers this tab's seat so a refresh rejoins the game
  components/
    DotPadPanel.jsx       Connect / Disconnect Dot Pad (Bluetooth or USB)
    Lobby.jsx             new game (online / computer / same device) and join-by-code
    GameView.jsx          status, invite code/link, board, rotation step
    Board.jsx             6x6 board as four spinnable quadrants; roving-focus keyboard grid
    RotationControls.jsx  the eight "turn quadrant" buttons (or "place and win")
    HowToPlay.jsx         rules and keyboard help
  dotpad/                 Dot Pad SDK 3.0.3 + helpers, copied unchanged from CrossMyMind
public/liblouis/          liblouis braille translation assets, as CrossMyMind
```

## How play works

- The server is the authority. The app sends a move (cell + rotation) and
  shows whatever state comes back, over the REST response or the WebSocket,
  whichever lands first. Duplicates and stale states are ignored.
- A turn is two steps on screen: choose a cell, then choose a quadrant and
  direction. Nothing is sent until the rotation is chosen. If the cell alone
  makes five in a row, the second step becomes "Place and win".
- When a move arrives, the board shows the marble placed, spins the quadrant
  (skipped under `prefers-reduced-motion`), then settles on the server's
  state. States that arrive mid-spin (a fast computer reply) wait their turn.
- Seats are kept in `sessionStorage`: a refresh rejoins the game, and two
  tabs in one browser can hold the two seats of an online game.

## Accessibility

- The board is one tab stop. Arrow keys move between all 36 cells, crossing
  quadrant boundaries; Home/End go along a row, Ctrl+Home/End to the corners.
  Enter or Space chooses an empty cell.
- Each cell's name says where and what it is: "C3, black, last move",
  "E1, white, winning line". Columns are A–F, rows 1–6 from the top.
- Choosing a cell moves focus to the rotation buttons, each fully labelled
  ("Turn top-left quadrant clockwise"). Escape goes back to the board.
- Every change is announced in a polite live region: moves by either player
  or the computer, an opponent joining, the result.
- axe runs in the test suite against the lobby and a game in progress.

## Dot Pad

The Connect to Dot Pad button sits in the page header and connects over
Bluetooth or USB in Chromium browsers, exactly as in CrossMyMind. The board
is not drawn on the device yet; that's the next step.
