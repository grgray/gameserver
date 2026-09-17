interface ValidMovesListProps {
  validMoves: [number, number][];
  gameOver: boolean;
}

// Spells out the legal moves in plain text so a screen reader user doesn't
// have to scan the board visually to know what they can type into MoveForm.
export function ValidMovesList({ validMoves, gameOver }: ValidMovesListProps) {
  if (gameOver) return null;

  return (
    <section aria-labelledby="valid-moves-heading" className="valid-moves">
      <h2 id="valid-moves-heading">Valid moves</h2>
      {validMoves.length === 0 ? (
        <p>No valid moves available; turn will be skipped.</p>
      ) : (
        <ul>
          {validMoves.map(([row, col]) => (
            <li key={`${row},${col}`}>
              Row {row + 1}, column {col + 1}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
