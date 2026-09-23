import { useEffect, useId, useRef } from "react";
import { DIRECTIONS, QUADRANTS, capitalize, cellName } from "../game.js";

const ARROWS = { clockwise: "↻", anticlockwise: "↺" };

// Second half of a turn: after choosing a cell, pick which quadrant to turn
// and which way. Laid out 2x2 like the quadrants themselves. Focus moves
// here when it appears; Escape (or Cancel) goes back to the board.
export default function RotationControls({ pending, winsOutright, disabled, onRotate, onConfirmWin, onCancel }) {
  const firstButton = useRef(null);
  const headingId = useId();

  useEffect(() => {
    firstButton.current?.focus();
  }, [pending.row, pending.col]);

  const where = cellName(pending.row, pending.col);

  return (
    <section
      className="rotation-controls card"
      aria-labelledby={headingId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      {winsOutright ? (
        <>
          <h2 id={headingId}>{where} makes five in a row</h2>
          <p>Placing here wins straight away, so there&apos;s no rotation.</p>
          <div className="rotation-actions">
            <button ref={firstButton} type="button" className="button" disabled={disabled} onClick={onConfirmWin}>
              Place at {where} and win
            </button>
            <button type="button" className="button button-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 id={headingId}>Placing at {where}: now turn a quadrant</h2>
          <div className="rotation-grid">
            {QUADRANTS.map((q, qi) => (
              <div key={q.id} className="rotation-quadrant" role="group" aria-label={`${capitalize(q.id)} quadrant`}>
                <span className="rotation-quadrant-name" aria-hidden="true">
                  {capitalize(q.id)}
                </span>
                {DIRECTIONS.map((direction, di) => (
                  <button
                    key={direction}
                    ref={qi === 0 && di === 0 ? firstButton : undefined}
                    type="button"
                    className="button button-secondary rotate-button"
                    disabled={disabled}
                    aria-label={`Turn ${q.id} quadrant ${direction}`}
                    onClick={() => onRotate(q.id, direction)}
                  >
                    <span aria-hidden="true">
                      {ARROWS[direction]} {capitalize(direction)}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button type="button" className="button button-secondary" onClick={onCancel}>
            Cancel, choose another cell
          </button>
        </>
      )}
    </section>
  );
}
