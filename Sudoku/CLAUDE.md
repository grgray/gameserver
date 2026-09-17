# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev       # start the Vite dev server (default port 5173)
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

There is no lint or test script configured for this project.

If `npm run dev`/`npm run build` fails with `'vite' is not recognized` or similar
missing-module errors, `node_modules` is likely incomplete (this has happened
before on this machine) — fix with a clean reinstall:

```sh
rm -rf node_modules && npm install
```

## Architecture

Plain JavaScript React app (no TypeScript) built with Vite. Two concerns are
kept deliberately separate:

- **`src/sudoku.js`** — pure puzzle logic, no UI or React imports.
  `generatePuzzle()` fills a full solved grid via randomized backtracking,
  then removes cells one at a time, using `countSolutions(..., limit=2)`
  after each removal to confirm the puzzle still has exactly one solution.
  Difficulty is just "how many clues are left" (`DIFFICULTY_CLUES`) — only
  `easy` is defined.
- **`src/App.jsx`** — single-component UI holding all game state (board
  entries, selection, timer, win state). The board uses a roving-tabindex
  pattern for keyboard accessibility: only the selected cell is in the tab
  order, arrow keys move `selected` and an effect calls `.focus()` on the
  newly-selected cell's DOM node. Conflicts (duplicate values in a row/
  column/box) are recomputed on every entry change via `findConflicts`.

### Dot Pad integration (`src/dotpad/`)

Lets a blind player pair a [Dot Pad](https://www.dotincorp.com/en/product/pad)
tactile display and drive it from the game. Built against Dot Incorporation's
official Web SDK v3.0.3 (from
[dotincorp/dotpad-sdk-guide](https://github.com/dotincorp/dotpad-sdk-guide/tree/main/Web/3.0.3)).

- **`DotPadSDK-3.0.3.js` / `.d.ts`** — the SDK itself, vendored verbatim
  (the SDK ships as a plain file, not an npm package — "copy into your
  project and import directly" per its own docs). Don't hand-edit these,
  replace wholesale when upgrading versions.
- **`dotpadClient.js`** — module-level singleton wrapping `DotPadScanner`
  (opens the browser's Bluetooth/Serial device picker) and `DotPadSDK`
  (manages the connection, registered once via `setCallBack`). Tracks the
  currently connected `DotDevice` and resets its display (`displayAllDown`)
  as soon as it reports `DataCodes.Connected`. Exposes `getDotPadSdk()` /
  `getConnectedDotPadDevice()` so later code can send display data or read
  key events without re-scanning or re-connecting.
- **`useDotPad.js`** — React hook wrapping the singleton (`connect(transport)`,
  `disconnect()`, `status`, `error`, `supported`) for `App.jsx`'s "Connect to
  Dot Pad" control.
- **`public/liblouis/`** — the SDK's bundled liblouis WebAssembly braille
  translation engine (not yet wired into the game). Served as static assets;
  the SDK loads them via `LiblouisManager.setAssetBaseUrl()`, not through the
  bundler. **These files, plus `DotPadSDK-3.0.3.js`/`.d.ts`, are marked
  `-text` in `.gitattributes`** — `liblouis.data` is a packed asset blob
  where byte offsets matter, and Windows `core.autocrlf` line-ending
  conversion on checkout would silently corrupt it. Don't remove that
  `.gitattributes` entry, and treat these vendored files as opaque (don't
  reformat/re-save them through a text editor that might normalize line
  endings).

**Status:** connecting and resetting the display works end-to-end (tested
with real hardware). Actually rendering the Sudoku board as tactile graphics/
braille — `displayGraphicData`/`displayTextData`/`translateText`, plus
reading key events (`onKeyDownCallBack`/`onKeyUpCallBack`, panning keys for
paging) — is not implemented yet; that's the next stage, currently on the
`sudokuwithdotpad` branch (already merged to `main` once, kept open to keep
building on).
