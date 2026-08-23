import { useState } from 'react';
import type { Level, Mark, Mode } from '../types';

interface NewGameFormProps {
  onStart: (opts: { mode: Mode; level: Level; mark: Mark }) => void;
  disabled?: boolean;
}

export function NewGameForm({ onStart, disabled }: NewGameFormProps) {
  const [mode, setMode] = useState<Mode>('human');
  const [level, setLevel] = useState<Level>(1);
  const [mark, setMark] = useState<Mark>('X');

  return (
    <form
      className="new-game"
      onSubmit={(e) => {
        e.preventDefault();
        onStart({ mode, level, mark });
      }}
    >
      <fieldset>
        <legend>Opponent</legend>
        <label>
          <input
            type="radio"
            name="mode"
            value="human"
            checked={mode === 'human'}
            onChange={() => setMode('human')}
          />
          Two players (share this screen)
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            value="computer"
            checked={mode === 'computer'}
            onChange={() => setMode('computer')}
          />
          Play the computer
        </label>
      </fieldset>

      {mode === 'computer' && (
        <>
          <div className="field">
            <label htmlFor="level">Difficulty</label>
            <select
              id="level"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value) as Level)}
            >
              <option value={1}>1 — Easy</option>
              <option value={2}>2 — Unbeatable</option>
            </select>
          </div>
          <fieldset>
            <legend>Play as</legend>
            <label>
              <input
                type="radio"
                name="mark"
                value="X"
                checked={mark === 'X'}
                onChange={() => setMark('X')}
              />
              X (moves first)
            </label>
            <label>
              <input
                type="radio"
                name="mark"
                value="O"
                checked={mark === 'O'}
                onChange={() => setMark('O')}
              />
              O (computer moves first)
            </label>
          </fieldset>
        </>
      )}

      <button type="submit" disabled={disabled}>
        Start game
      </button>
    </form>
  );
}
