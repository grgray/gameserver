import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import DotPadPanel from "./components/DotPadPanel.jsx";
import GameView from "./components/GameView.jsx";
import HowToPlay from "./components/HowToPlay.jsx";
import Lobby from "./components/Lobby.jsx";
import { ApiError, createGame, getGame, joinGame, makeMove, watchGame } from "./api.js";
import { useDotPad } from "./dotpad/useDotPad.js";
import { initialState, reducer } from "./gameState.js";
import { clearSeat, loadSeat, saveSeat } from "./seatStorage.js";

// Longest a rotation animation may take before the board moves on anyway
// (e.g. if the animationend event never arrives).
const SPIN_FALLBACK_MS = 1000;

function motionAllowed() {
  return Boolean(window.matchMedia) && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function joinCodeFromUrl() {
  return new URLSearchParams(window.location.search).get("join")?.toUpperCase() ?? "";
}

function clearJoinCodeFromUrl() {
  if (!window.location.search) return;
  window.history.replaceState(null, "", window.location.pathname);
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(() => Boolean(loadSeat()));
  const dotPad = useDotPad();
  const boardRef = useRef(null);
  const gameId = state.seat?.gameId;

  const sit = useCallback((seatResponse) => {
    const seat = {
      gameId: seatResponse.game.id,
      token: seatResponse.playerToken,
      colors: seatResponse.colors,
      joinCode: seatResponse.joinCode,
    };
    saveSeat(seat);
    clearJoinCodeFromUrl();
    dispatch({ type: "seated", seat, game: seatResponse.game });
  }, []);

  // Back into a saved game after a refresh, if the server still has it.
  useEffect(() => {
    const saved = loadSeat();
    if (!saved) return;
    getGame(saved.gameId)
      .then((game) => dispatch({ type: "seated", seat: saved, game }))
      .catch(() => clearSeat())
      .finally(() => setRestoring(false));
  }, []);

  // Live updates: opponent joins and moves, the computer's replies.
  useEffect(() => {
    if (!gameId) return undefined;
    return watchGame(gameId, (game) => dispatch({ type: "received", game, animate: motionAllowed() }));
  }, [gameId]);

  const spinMoveCount = state.spin?.next.moveCount;
  const finishSpin = useCallback(() => {
    if (spinMoveCount !== undefined) {
      dispatch({ type: "spinFinished", moveCount: spinMoveCount, animate: motionAllowed() });
    }
  }, [spinMoveCount]);

  useEffect(() => {
    if (spinMoveCount === undefined) return undefined;
    const timer = setTimeout(finishSpin, SPIN_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [spinMoveCount, finishSpin]);

  async function handleCreate(options) {
    setBusy(true);
    try {
      sit(await createGame(options));
    } catch (err) {
      dispatch({ type: "error", error: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(code) {
    setBusy(true);
    try {
      sit(await joinGame(code));
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 404
          ? `No game is waiting for the code ${code}. Check it with your friend; each code works once.`
          : err.message;
      dispatch({ type: "error", error: message });
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(move) {
    const { seat } = state;
    boardRef.current?.focusCell(move.row, move.col);
    dispatch({ type: "submitStarted" });
    try {
      const game = await makeMove(seat.gameId, seat.token, move);
      dispatch({ type: "received", game, animate: motionAllowed() });
      dispatch({ type: "submitFinished" });
    } catch (err) {
      dispatch({ type: "submitFailed", error: err.message });
    }
  }

  function handleCancelCell() {
    const { pending } = state;
    dispatch({ type: "cellCleared" });
    if (pending) boardRef.current?.focusCell(pending.row, pending.col);
  }

  function handleLeave() {
    clearSeat();
    dispatch({ type: "left" });
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Pentago</h1>
        <DotPadPanel dotPad={dotPad} />
      </header>

      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        <p key={state.announcement.id}>{state.announcement.text}</p>
      </div>

      {state.error && (
        <p className="error-banner" role="alert">
          {state.error}
        </p>
      )}

      {state.game ? (
        <GameView
          state={state}
          boardRef={boardRef}
          onChooseCell={(row, col) => dispatch({ type: "cellChosen", row, col })}
          onCancelCell={handleCancelCell}
          onMove={handleMove}
          onSpinFinished={finishSpin}
          onLeave={handleLeave}
        />
      ) : restoring ? (
        <p className="loading">Loading your game…</p>
      ) : (
        <Lobby busy={busy} initialJoinCode={joinCodeFromUrl()} onCreate={handleCreate} onJoin={handleJoin} />
      )}

      <HowToPlay />
    </div>
  );
}
