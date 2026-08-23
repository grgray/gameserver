import type { Mark, Status } from '../types';

interface StatusPanelProps {
  status: Status;
  turn?: Mark;
  winner?: Mark;
  humanMark?: Mark;
}

export function StatusPanel({ status, turn, winner, humanMark }: StatusPanelProps) {
  const isGameOver = status !== 'in_progress';

  let message: string;
  if (status === 'in_progress') {
    if (humanMark && turn !== humanMark) {
      message = 'Computer is thinking\u2026';
    } else {
      message = `${turn ?? 'X'}'s turn`;
    }
  } else if (status === 'draw') {
    message = "It's a draw.";
  } else if (humanMark) {
    message = winner === humanMark ? 'You win!' : 'Computer wins!';
  } else {
    message = `${winner} wins!`;
  }

  return (
    <p className="status" role={isGameOver ? 'alert' : 'status'}>
      {message}
    </p>
  );
}
