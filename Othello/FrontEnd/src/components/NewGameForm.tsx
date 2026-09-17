import { useState } from 'react';
import type { Difficulty, NewGameOptions } from '../types';

interface NewGameFormProps {
  onStart: (opts: NewGameOptions) => void;
  disabled?: boolean;
}

export function NewGameForm({ onStart, disabled }: NewGameFormProps) {
  const [playAgainstComputer, setPlayAgainstComputer] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  return (
    <form
      className="new-game"
      onSubmit={(e) => {
        e.preventDefault();
        onStart({ playAgainstComputer, difficulty });
      }}
    >
      <fieldset>
        <legend>Opponent</legend>
        <label>
          <input
            type="radio"
            name="opponent"
            value="computer"
            checked={playAgainstComputer}
            onChange={() => setPlayAgainstComputer(true)}
          />
          Play the computer
        </label>
        <label>
          <input
            type="radio"
            name="opponent"
            value="human"
            checked={!playAgainstComputer}
            onChange={() => setPlayAgainstComputer(false)}
          />
          Two players (share this screen)
        </label>
      </fieldset>

      {playAgainstComputer && (
        <div className="field">
          <label htmlFor="difficulty">Computer difficulty</label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      )}

      <p className="hint">Black always moves first.</p>

      <button type="submit" disabled={disabled}>
        Start game
      </button>
    </form>
  );
}
