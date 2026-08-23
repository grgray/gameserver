import { useCallback, useState } from 'react';
import { ApiError, createGame, move } from './api';
import { Board } from './components/Board';
import { NewGameForm } from './components/NewGameForm';
import { StatusPanel } from './components/StatusPanel';
import { getWinningLine } from './game';
import type { GameState, Level, Mark, Mode } from './types';
import './App.css';

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startGame = useCallback(async (opts: { mode: Mode; level: Level; mark: Mark }) => {
    setBusy(true);
    setError(null);
    try {
      setGame(await createGame(opts));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to start game.');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleCellClick = useCallback(
    async (cell: number) => {
      if (!game || busy) return;
      setBusy(true);
      setError(null);
      try {
        setGame(await move(game.id, cell));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Move failed.');
      } finally {
        setBusy(false);
      }
    },
    [game, busy],
  );

  const winningLine = game ? getWinningLine(game.board) : null;

  return (
    <main className="app">
      <h1>Tic-Tac-Toe</h1>

      <NewGameForm onStart={startGame} disabled={busy} />

      <section aria-labelledby="board-heading">
        <h2 id="board-heading" className="board-heading">
          Game board
        </h2>
        {game ? (
          <>
            <StatusPanel
              status={game.status}
              turn={game.turn}
              winner={game.winner}
              humanMark={game.mark}
            />
            <Board
              board={game.board}
              status={game.status}
              turn={game.turn}
              humanMark={game.mark}
              winningLine={winningLine}
              onCellClick={handleCellClick}
            />
          </>
        ) : (
          <p className="placeholder">Start a game to begin.</p>
        )}
      </section>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
