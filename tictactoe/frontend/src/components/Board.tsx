import type { Mark, Status } from '../types';
import { Cell } from './Cell';

interface BoardProps {
  board: ('' | Mark)[];
  status: Status;
  turn?: Mark;
  humanMark?: Mark;
  winningLine: number[] | null;
  onCellClick: (cell: number) => void;
}

export function Board({ board, status, turn, humanMark, winningLine, onCellClick }: BoardProps) {
  const inProgress = status === 'in_progress';
  const humanTurn = !humanMark || turn === humanMark;

  return (
    <div className="board" role="group" aria-labelledby="board-heading">
      {board.map((value, i) => {
        const disabled = !inProgress || !humanTurn || value !== '';
        const winner = winningLine?.includes(i) ?? false;
        return (
          <Cell
            key={i}
            index={i}
            value={value}
            disabled={disabled}
            winner={winner}
            onClick={() => onCellClick(i + 1)}
          />
        );
      })}
    </div>
  );
}
