import { useState } from 'react';
import type { FormEvent } from 'react';

interface MoveFormProps {
  onMove: (row: number, col: number) => void;
  disabled?: boolean;
}

const BOARD_SIZE = 8;

function parseCoordinate(value: string): number | null {
  const trimmed = value.trim();
  if (!/^[1-9][0-9]*$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (n < 1 || n > BOARD_SIZE) return null;
  return n;
}

// Moves are entered as row/column numbers (1-8) in plain text boxes rather
// than by clicking board cells, so the game is fully operable with a
// keyboard or screen reader and doesn't depend on pointer precision.
export function MoveForm({ onMove, disabled }: MoveFormProps) {
  const [row, setRow] = useState('');
  const [col, setCol] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const rowNum = parseCoordinate(row);
    const colNum = parseCoordinate(col);

    if (rowNum === null || colNum === null) {
      setValidationError(`Enter a row and column number between 1 and ${BOARD_SIZE}.`);
      return;
    }

    setValidationError(null);
    onMove(rowNum - 1, colNum - 1);
    setRow('');
    setCol('');
  };

  return (
    <form className="move-form" onSubmit={handleSubmit} aria-label="Play a move">
      <div className="move-fields">
        <div className="field">
          <label htmlFor="move-row">Row (1-8)</label>
          <input
            id="move-row"
            name="row"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={row}
            disabled={disabled}
            aria-describedby="move-form-hint"
            onChange={(e) => setRow(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="move-col">Column (1-8)</label>
          <input
            id="move-col"
            name="col"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={col}
            disabled={disabled}
            aria-describedby="move-form-hint"
            onChange={(e) => setCol(e.target.value)}
          />
        </div>
        <button type="submit" disabled={disabled}>
          Play move
        </button>
      </div>
      <p id="move-form-hint" className="hint">
        Row 1 is the top of the board, column 1 is the left edge.
      </p>
      {validationError && (
        <p className="error" role="alert">
          {validationError}
        </p>
      )}
    </form>
  );
}
