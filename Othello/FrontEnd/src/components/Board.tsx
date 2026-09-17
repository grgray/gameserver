import type { CellValue, Player } from '../types';

interface BoardProps {
  board: CellValue[][];
  validMoves: [number, number][];
  currentPlayer: Player;
  gameOver: boolean;
}

const COLUMN_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8'];

function describeCell(value: CellValue, isValidMove: boolean, currentPlayer: Player): string {
  if (value === 'black') return 'Black piece';
  if (value === 'white') return 'White piece';
  return isValidMove ? `Empty, valid move for ${currentPlayer}` : 'Empty';
}

// A read-only view of the board. Moves are entered through MoveForm's text
// boxes, not by interacting with this table, but the table is still marked
// up so screen reader users can review the position cell by cell.
export function Board({ board, validMoves, currentPlayer, gameOver }: BoardProps) {
  const validMoveSet = new Set(validMoves.map(([r, c]) => `${r},${c}`));

  return (
    <div className="board-wrap">
      <table className="board">
        <caption className="visually-hidden">
          Othello board, 8 rows by 8 columns. Rows and columns are numbered 1 to 8.
        </caption>
        <thead>
          <tr>
            <th scope="col">&nbsp;</th>
            {COLUMN_LABELS.map((label) => (
              <th scope="col" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {board.map((rowCells, rowIndex) => (
            <tr key={rowIndex}>
              <th scope="row">{rowIndex + 1}</th>
              {rowCells.map((value, colIndex) => {
                const isValidMove = !gameOver && validMoveSet.has(`${rowIndex},${colIndex}`);
                return (
                  <td
                    key={colIndex}
                    className={isValidMove ? 'cell valid-move' : 'cell'}
                    aria-label={describeCell(value, isValidMove, currentPlayer)}
                  >
                    {value === 'black' && <span className="piece piece-black" aria-hidden="true" />}
                    {value === 'white' && <span className="piece piece-white" aria-hidden="true" />}
                    {value === '' && isValidMove && <span className="dot" aria-hidden="true" />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
