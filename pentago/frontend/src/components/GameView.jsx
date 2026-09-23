import { useMemo, useState } from "react";
import Board from "./Board.jsx";
import RotationControls from "./RotationControls.jsx";
import {
  capitalize,
  describeMove,
  describeStatus,
  hasFive,
  isMyTurn,
  lastPlacedCell,
  placeMarble,
} from "../game.js";

const MODE_NAMES = { online: "Online game", local: "Two players, one device", computer: "Against the computer" };

function ShareCode({ joinCode }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?join=${joinCode}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="share card">
      <h2>Invite your opponent</h2>
      <p>
        Give them this join code: <strong className="join-code">{joinCode.split("").join(" ")}</strong>
      </p>
      <p>
        Or send them the link: <span className="share-link">{link}</span>
      </p>
      <button type="button" className="button button-secondary" onClick={copy}>
        Copy link
      </button>
      <span role="status" className="copy-status">
        {copied ? "Link copied." : ""}
      </span>
    </div>
  );
}

export default function GameView({ state, boardRef, onChooseCell, onCancelCell, onMove, onSpinFinished, onLeave }) {
  const { game, seat, pending, spin, submitting } = state;
  const colors = seat.colors;
  const myTurn = isMyTurn(game, colors) && !spin;
  const mover = game.currentPlayer;

  const winningCells = useMemo(() => {
    const cells = new Set();
    if (!spin) for (const line of game.winningLines) for (const [r, c] of line) cells.add(`${r}-${c}`);
    return cells;
  }, [game.winningLines, spin]);

  const winsOutright = useMemo(
    () => Boolean(pending) && hasFive(placeMarble(game.board, pending.row, pending.col, mover), mover),
    [pending, game.board, mover]
  );

  const shownGame = spin ? spin.next : game;
  const seatDescription =
    colors.length === 2 ? "You are playing both colours." : `You are playing ${colors[0]}.`;

  return (
    <main className="game">
      <section className="status card" aria-labelledby="status-heading">
        <h2 id="status-heading">{MODE_NAMES[game.mode]}</h2>
        <p>
          {seatDescription}
          {game.difficulty ? ` Difficulty: ${capitalize(game.difficulty)}.` : ""}
        </p>
        <p className="status-line">{describeStatus(shownGame, colors)}</p>
        {shownGame.lastMove && <p className="last-move">Last move: {describeMove(shownGame.lastMove)}</p>}
      </section>

      {game.status === "waiting_for_opponent" && seat.joinCode && <ShareCode joinCode={seat.joinCode} />}

      <div className="play-area">
        <Board
          ref={boardRef}
          board={spin ? spin.board : game.board}
          pending={pending}
          pendingColor={mover}
          spin={spin}
          lastPlaced={spin ? null : lastPlacedCell(game.lastMove)}
          winningCells={winningCells}
          canPlace={myTurn && !submitting && !pending}
          onChooseCell={onChooseCell}
          onSpinFinished={onSpinFinished}
        />

        {pending && myTurn && (
          <RotationControls
            pending={pending}
            winsOutright={winsOutright}
            disabled={submitting}
            onRotate={(quadrant, direction) => onMove({ ...pending, rotation: { quadrant, direction } })}
            onConfirmWin={() => onMove({ ...pending, rotation: null })}
            onCancel={onCancelCell}
          />
        )}
      </div>

      <div className="game-actions">
        <button type="button" className="button button-secondary" onClick={onLeave}>
          {game.status === "in_progress" || game.status === "waiting_for_opponent" ? "Leave game" : "New game"}
        </button>
      </div>
    </main>
  );
}
