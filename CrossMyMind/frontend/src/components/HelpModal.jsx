import { forwardRef } from "react";

// A native <dialog> gives us Escape-to-close and focus handling for free —
// showModal() traps focus inside it and closes it on Escape without any
// custom key handling needed here.
const HelpModal = forwardRef(function HelpModal(_props, ref) {
  return (
    <dialog ref={ref} className="help-dialog" aria-labelledby="help-dialog-title">
      <div className="help-dialog-header">
        <h2 id="help-dialog-title">Cross My Mind — Manual</h2>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => ref.current?.close()}
        >
          Close
        </button>
      </div>

      <h3>Overview</h3>
      <p>
        Cross My Mind generates a crossword puzzle for any subject you type in. Solve it on
        screen with a mouse and keyboard, or connect a Dot Pad tactile display to feel the
        grid and play entirely from its own buttons.
      </p>

      <h3>Connecting a Dot Pad</h3>
      <p>
        Use the <strong>Connect to Dot Pad</strong> button near the top of the page, then
        choose Bluetooth or USB. Once connected, the grid is drawn on the Dot Pad's tactile
        display and stays in sync as you play: blocked squares are raised, and any letter
        you've entered appears in its cell.
      </p>

      <h3>Playing with a keyboard</h3>
      <ul>
        <li>Click a cell, or a clue in the Across/Down lists, to select it.</li>
        <li>Arrow keys move between cells, skipping over blocked squares.</li>
        <li>Type a letter to fill the selected cell; the cursor advances automatically.</li>
        <li>
          Backspace clears the selected cell, or if it's already empty, steps back and
          clears the previous one instead.
        </li>
        <li>
          <strong>Escape</strong> releases focus from the grid, so a screen reader's own
          navigation keys work again.
        </li>
      </ul>

      <h3>Playing with the Dot Pad's own buttons</h3>
      <p>
        The Dot Pad has six buttons: Panning Left, Panning Right, and Function 1–4. Used
        alone or in combination, they cover everything you need without touching the
        keyboard.
      </p>

      <h4>Moving around the grid</h4>
      <ul>
        <li>
          <strong>Panning Left</strong> alone — move left (same as the ← key)
        </li>
        <li>
          <strong>Panning Right</strong> alone — move right (same as the → key)
        </li>
        <li>
          <strong>F1</strong> alone — move up (same as the ↑ key)
        </li>
        <li>
          <strong>F4</strong> alone — move down (same as the ↓ key)
        </li>
      </ul>

      <h4>Entering letters</h4>
      <p>
        Each button stands in for one braille dot position: Panning Left is dot 3, F1 is
        dot 2, F2 is dot 1, F3 is dot 4, F4 is dot 5, and Panning Right is dot 6. To enter a
        letter, hold down the buttons for that letter's dots together and then release —
        the same way you'd form it on a Perkins-style brailler.
      </p>

      <h4>Backspace</h4>
      <p>
        Press all six buttons together to backspace: it clears the selected cell, or if
        it's already empty, steps back and clears the previous cell instead.
      </p>

      <h4>Shortcuts</h4>
      <ul>
        <li>
          <strong>F1 + F4</strong> together — reveal the current clue's answer
        </li>
        <li>
          <strong>Panning Left + Panning Right</strong> together — reveal the whole
          solution
        </li>
        <li>
          <strong>Panning Left + F1</strong> together — pan the clue text line left
        </li>
        <li>
          <strong>Panning Right + F4</strong> together — pan the clue text line right
        </li>
      </ul>

      <h3>Reading the clue on the Dot Pad</h3>
      <p>
        The Dot Pad's single-line braille display always shows the clue for whichever word
        is currently selected, including its number, direction, and letter count. If it's
        longer than the display, pan through it using the panning shortcuts above.
      </p>

      <h3>Reveal buttons</h3>
      <p>
        <strong>Reveal Clue</strong> fills in the answer for the currently selected word,
        and <strong>Reveal Solution</strong> fills in the entire grid. Both are available
        on-screen below the grid, and as Dot Pad button combinations above.
      </p>

      <h3>Saving and loading</h3>
      <p>
        <strong>Save Game</strong> stores your current puzzle and progress in this browser,
        and <strong>Load Game</strong> brings back whatever you last saved — available even
        before you've generated a new puzzle.
      </p>
    </dialog>
  );
});

export default HelpModal;
