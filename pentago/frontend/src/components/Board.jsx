import { useId, useImperativeHandle, useRef, useState } from "react";
import { QUADRANTS, SIZE, capitalize, cellName } from "../game.js";

const COLUMN_HEADINGS = ["A", "B", "C", "D", "E", "F"];

// Headings line up with the cells, skipping the gap between quadrants.
function headingsWithGap(labels) {
  const spans = labels.map((label) => <span key={label}>{label}</span>);
  return [...spans.slice(0, 3), <span key="gap" />, ...spans.slice(3)];
}

function cellLabel({ row, col, color, isPending, pendingColor, isLast, isWinning }) {
  const parts = [cellName(row, col)];
  if (isPending) parts.push(`${pendingColor}, chosen, not yet played`);
  else parts.push(color ?? "empty");
  if (isLast) parts.push("last move");
  if (isWinning) parts.push("winning line");
  return parts.join(", ");
}

// The 6x6 board, drawn as four 3x3 quadrants so a quadrant can spin as one
// piece. Every cell is a button; the board is a single tab stop and the
// arrow keys move between cells (Home/End jump along a row, Ctrl+Home/End to
// the corners). Enter or Space on an empty cell chooses it.
export default function Board({
  ref,
  board,
  pending,
  pendingColor,
  spin,
  lastPlaced,
  winningCells,
  canPlace,
  onChooseCell,
  onSpinFinished,
}) {
  const [focus, setFocus] = useState([0, 0]);
  const cellRefs = useRef({});
  const instructionsId = useId();

  function focusCell(row, col) {
    setFocus([row, col]);
    cellRefs.current[`${row}-${col}`]?.focus();
  }

  useImperativeHandle(ref, () => ({ focusCell }));

  function handleKeyDown(event, row, col) {
    let next;
    switch (event.key) {
      case "ArrowUp":
        next = [Math.max(0, row - 1), col];
        break;
      case "ArrowDown":
        next = [Math.min(SIZE - 1, row + 1), col];
        break;
      case "ArrowLeft":
        next = [row, Math.max(0, col - 1)];
        break;
      case "ArrowRight":
        next = [row, Math.min(SIZE - 1, col + 1)];
        break;
      case "Home":
        next = event.ctrlKey ? [0, 0] : [row, 0];
        break;
      case "End":
        next = event.ctrlKey ? [SIZE - 1, SIZE - 1] : [row, SIZE - 1];
        break;
      default:
        return;
    }
    event.preventDefault();
    focusCell(...next);
  }

  function renderCell(row, col) {
    const color = board[row][col];
    const isPending = pending?.row === row && pending?.col === col;
    const isLast = lastPlaced?.[0] === row && lastPlaced?.[1] === col;
    const isWinning = winningCells.has(`${row}-${col}`);
    const shown = isPending ? pendingColor : color;
    const classes = ["cell", isPending && "pending", isLast && "last", isWinning && "winning"]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        key={`${row}-${col}`}
        ref={(el) => {
          cellRefs.current[`${row}-${col}`] = el;
        }}
        type="button"
        className={classes}
        tabIndex={focus[0] === row && focus[1] === col ? 0 : -1}
        aria-label={cellLabel({ row, col, color, isPending, pendingColor, isLast, isWinning })}
        aria-describedby={instructionsId}
        aria-disabled={!canPlace || color !== null}
        onClick={() => {
          setFocus([row, col]);
          if (canPlace && color === null) onChooseCell(row, col);
        }}
        onKeyDown={(event) => handleKeyDown(event, row, col)}
      >
        {shown && <span className={`marble marble-${shown}`} aria-hidden="true" />}
      </button>
    );
  }

  return (
    <div className="board-frame">
      <p id={instructionsId} className="visually-hidden">
        Arrow keys move between cells. Enter places a marble on an empty cell.
      </p>
      <div className="column-headings" aria-hidden="true">
        {headingsWithGap(COLUMN_HEADINGS)}
      </div>
      <div className="row-headings" aria-hidden="true">
        {headingsWithGap(Array.from({ length: SIZE }, (_, i) => String(i + 1)))}
      </div>
      <div className="board" role="group" aria-label="Board">
        {QUADRANTS.map((q) => {
          const spinning = spin?.quadrant === q.id;
          return (
            <div
              key={q.id}
              role="group"
              aria-label={`${capitalize(q.id)} quadrant`}
              className={`quadrant quadrant-${q.id}${spinning ? ` spin-${spin.direction}` : ""}`}
              onAnimationEnd={spinning ? onSpinFinished : undefined}
            >
              {[0, 1, 2].map((r) => [0, 1, 2].map((c) => renderCell(q.row + r, q.col + c)))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
