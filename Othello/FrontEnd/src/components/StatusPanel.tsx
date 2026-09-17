import type { GameState } from '../types';

interface StatusPanelProps {
  game: GameState;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function StatusPanel({ game }: StatusPanelProps) {
  let message: string;

  if (game.gameOver) {
    message =
      game.score.winner === 'Tie'
        ? `Game over: it's a tie, ${game.score.black} to ${game.score.white}.`
        : `Game over: ${game.score.winner} wins, ${game.score.black} to ${game.score.white}.`;
  } else {
    message = `${capitalize(game.currentPlayer)}'s turn.`;
  }

  return (
    <p className="status" role={game.gameOver ? 'alert' : 'status'}>
      {message}
    </p>
  );
}
