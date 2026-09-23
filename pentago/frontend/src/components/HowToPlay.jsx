export default function HowToPlay() {
  return (
    <details className="how-to-play card">
      <summary>How to play</summary>
      <p>
        Pentago is played on a 6 by 6 board made of four 3 by 3 quadrants. Get five of your marbles in a row
        (across, down or diagonally) to win. Black moves first.
      </p>
      <p>Each turn has two steps:</p>
      <ol>
        <li>Place a marble on any empty cell.</li>
        <li>
          Turn any one quadrant a quarter turn, clockwise or anticlockwise. It doesn&apos;t have to be the quadrant
          you just placed in.
        </li>
      </ol>
      <p>
        If your placement already makes five in a row, you win straight away without turning. If a turn makes five in
        a row for both players at once, the game is a draw, as is a full board with no winner.
      </p>
      <h3>Keyboard</h3>
      <ul>
        <li>Tab to the board, then use the arrow keys to move between cells.</li>
        <li>Press Enter or Space on an empty cell to choose it.</li>
        <li>Then choose a quadrant and direction from the turn buttons, or press Escape to pick another cell.</li>
      </ul>
      <p>Cells are named by column letter A to F and row number 1 to 6, so A1 is the top-left corner.</p>
    </details>
  );
}
