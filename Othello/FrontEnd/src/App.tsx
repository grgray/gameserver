import { useCallback, useState } from 'react';
import { ApiError, createGame, makeMove } from './api';
import { Board } from './components/Board';
import { MoveForm } from './components/MoveForm';
import { NewGameForm } from './components/NewGameForm';
import { ScorePanel } from './components/ScorePanel';
import { StatusPanel } from './components/StatusPanel';
import { ValidMovesList } from './components/ValidMovesList';
import type { GameState, NewGameOptions } from './types';
import './App.css';

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startGame = useCallback(async (opts: NewGameOptions) => {
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

  const handleMove = useCallback(
    async (row: number, col: number) => {
      if (!game || busy) return;
      setBusy(true);
      setError(null);
      try {
        setGame(await makeMove(game.id, row, col));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Move failed.');
      } finally {
        setBusy(false);
      }
    },
    [game, busy],
  );

  const moveFormDisabled = !game || busy || game.gameOver;

  return (
    <main className="app">
      <h1>Othello</h1>

      <NewGameForm onStart={startGame} disabled={busy} />

      {game ? (
        <>
          <section aria-labelledby="status-heading">
            <h2 id="status-heading" className="visually-hidden">
              Game status
            </h2>
            <StatusPanel game={game} />
            <ScorePanel score={game.score} />
          </section>

          <section aria-labelledby="board-heading">
            <h2 id="board-heading" className="board-heading">
              Board
            </h2>
            <Board
              board={game.board}
              validMoves={game.validMoves}
              currentPlayer={game.currentPlayer}
              gameOver={game.gameOver}
            />
          </section>

          <MoveForm onMove={handleMove} disabled={moveFormDisabled} />

          <ValidMovesList validMoves={game.validMoves} gameOver={game.gameOver} />
        </>
      ) : (
        <p className="placeholder">Start a game to begin.</p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
