import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  generatePuzzle,
  findConflicts,
  isBoardComplete,
} from './sudoku.js';
import { useDotPad } from './dotpad/useDotPad.js';
import { announceDotPadText, displayDotPadGraphic, subscribeDotPadChord } from './dotpad/dotpadClient.js';
import { BrlToHex } from './dotpad/brailleHex.js';
import './App.css';

// Dot Pad button chords -> action, keyed by the chord's canonical string
// (see subscribeDotPadChord: which keys were held together, sorted — "1"-"4"
// for Function 1-4, "L"/"R" for Panning Left/Right). A single button counts
// as a one-key chord, so Panning Left/Right alone move across columns and
// F1/F4 alone move up/down, same as the arrow keys; the Function-key combos
// enter the matching digit, and Panning Left+F2+F4 clears the cell.
const DOT_PAD_CHORD_ACTIONS = {
  L: 'left',
  R: 'right',
  1: 'up',
  4: 'down',
  2: 1,
  12: 2,
  23: 3,
  234: 4,
  24: 5,
  123: 6,
  1234: 7,
  124: 8,
  13: 9,
  '24L': 'clear',
};

const SIZE = 9;

// Standard braille numeral dot patterns (digits 1-9 share the dot patterns
// of letters a-i). An empty cell (value 0) has no dots of its own here.
const DIGIT_DOTS = {
  1: '1',
  2: '12',
  3: '14',
  4: '145',
  5: '15',
  6: '124',
  7: '1245',
  8: '125',
  9: '24',
};

// The Dot Pad's graphic area is 30 cells wide per line.
const GRAPHIC_LINE_WIDTH = 30;

// Builds one board row's braille cells — a blank cell between each column so
// digits stay distinguishable (column 0 at cell 0, column 1 at cell 2, and
// so on — see BrlToHex), padded with blanks out to the full line width so
// the next row lands exactly at the start of the following line. The
// selected column (-1 if the selection isn't on this row) gets dot 6 added
// on top of its usual dots, as a marker for which cell is selected.
function buildRowHex(rowValues, selectedCol) {
  const cells = rowValues.map((value, col) => {
    const dots = (value === 0 ? '135' : DIGIT_DOTS[value]) + (col === selectedCol ? '6' : '');
    return BrlToHex(dots);
  });
  const rowHex = cells.join('00');
  const usedCells = cells.length * 2 - 1;
  const paddingCells = Math.max(0, GRAPHIC_LINE_WIDTH - usedCells);
  return rowHex + '00'.repeat(paddingCells);
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function cellKey(row, col) {
  return `${row},${col}`;
}

function describeCell(row, col, value, isGiven, hasConflict) {
  return `Row ${row + 1}, column ${col + 1}, ${
    value === 0 ? 'empty' : `value ${value}`
  }${isGiven ? ', given clue' : ''}${hasConflict ? ', conflicting value' : ''}`;
}

// Shorter form for the Dot Pad's braille text line — "R"/"C" instead of the
// spelled-out "Row"/"column" used in the on-screen aria-label above, and
// "cl"/"v" instead of "value" to distinguish a given clue from a value the
// player typed in.
function describeCellForDotPad(row, col, value, isGiven, hasConflict) {
  const valuePart = value === 0 ? 'empty' : `${isGiven ? 'cl' : 'v'}${value}`;
  return `R${row + 1} C${col + 1}, ${valuePart}${
    hasConflict ? ', conflicting value' : ''
  }`;
}

export default function App() {
  const [{ puzzle, solution }, setGame] = useState(() => generatePuzzle('easy'));
  const [entries, setEntries] = useState(() => cloneBoard(puzzle));
  const [selected, setSelected] = useState({ row: 0, col: 0 });
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [announcement, setAnnouncement] = useState('');
  const [won, setWon] = useState(false);
  const boardRef = useRef(null);

  const dotPad = useDotPad();
  const [dotPadMenuOpen, setDotPadMenuOpen] = useState(false);

  const givenMask = useMemo(
    () => puzzle.map((row) => row.map((value) => value !== 0)),
    [puzzle],
  );

  const conflicts = useMemo(() => findConflicts(entries), [entries]);

  // Timer
  useEffect(() => {
    if (!isRunning) return undefined;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // Win detection
  useEffect(() => {
    if (won) return;
    if (isBoardComplete(entries) && conflicts.size === 0) {
      setWon(true);
      setIsRunning(false);
      setAnnouncement(`Solved in ${formatTime(seconds)}. Well done!`);
    }
  }, [entries, conflicts, won, seconds]);

  // Close the transport menu once a connection attempt resolves.
  useEffect(() => {
    if (dotPad.status !== 'connecting') setDotPadMenuOpen(false);
  }, [dotPad.status]);

  // Select (and focus — see the roving-tabindex effect below) the first
  // cell as soon as the Dot Pad connects, so Panning/Function keys can
  // navigate the board right away without clicking into it first.
  useEffect(() => {
    if (dotPad.status === 'connected') setSelected({ row: 0, col: 0 });
  }, [dotPad.status]);

  const handleDotPadTransport = useCallback(
    (transport) => {
      dotPad.connect(transport);
    },
    [dotPad],
  );

  const startNewGame = useCallback(() => {
    const next = generatePuzzle('easy');
    setGame(next);
    setEntries(cloneBoard(next.puzzle));
    setSelected({ row: 0, col: 0 });
    setSeconds(0);
    setIsRunning(true);
    setWon(false);
    setAnnouncement('New puzzle generated.');
  }, []);

  const setCellValue = useCallback(
    (row, col, value) => {
      if (givenMask[row][col] || won) return;
      setEntries((prev) => {
        if (prev[row][col] === value) return prev;
        const next = cloneBoard(prev);
        next[row][col] = value;
        return next;
      });
    },
    [givenMask, won],
  );

  // Moves the selection relative to wherever it currently is (via the
  // functional setState form, so this stays correct however it's called —
  // from a cell's own keydown handler or from an unrelated event listener
  // like the Dot Pad key subscription below — without needing `selected`
  // in any dependency array).
  const moveSelectionBy = useCallback((deltaRow, deltaCol) => {
    setSelected((prev) => ({
      row: Math.max(0, Math.min(SIZE - 1, prev.row + deltaRow)),
      col: Math.max(0, Math.min(SIZE - 1, prev.col + deltaCol)),
    }));
  }, []);

  const handleCellKeyDown = useCallback(
    (event, row, col) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          moveSelectionBy(-1, 0);
          break;
        case 'ArrowDown':
          event.preventDefault();
          moveSelectionBy(1, 0);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          moveSelectionBy(0, -1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          moveSelectionBy(0, 1);
          break;
        case 'Backspace':
        case 'Delete':
        case '0':
          event.preventDefault();
          setCellValue(row, col, 0);
          break;
        default:
          if (/^[1-9]$/.test(event.key)) {
            event.preventDefault();
            setCellValue(row, col, Number(event.key));
          }
      }
    },
    [moveSelectionBy, setCellValue],
  );

  // Keep DOM focus in sync with the selected cell (roving tabindex pattern).
  useEffect(() => {
    const node = boardRef.current?.querySelector(
      `[data-row="${selected.row}"][data-col="${selected.col}"]`,
    );
    node?.focus();
  }, [selected]);

  // Dot Pad button chords: fires once a chord is fully released (see
  // subscribeDotPadChord and DOT_PAD_CHORD_ACTIONS above).
  useEffect(
    () =>
      subscribeDotPadChord((chord) => {
        const action = DOT_PAD_CHORD_ACTIONS[chord];
        if (action === 'up') moveSelectionBy(-1, 0);
        else if (action === 'down') moveSelectionBy(1, 0);
        else if (action === 'left') moveSelectionBy(0, -1);
        else if (action === 'right') moveSelectionBy(0, 1);
        else if (action === 'clear') setCellValue(selected.row, selected.col, 0);
        else if (typeof action === 'number') {
          setCellValue(selected.row, selected.col, action);
        }
      }),
    [moveSelectionBy, setCellValue, selected],
  );

  const selectedValue = entries[selected.row][selected.col];

  const selectedCellLabel = useMemo(
    () =>
      describeCellForDotPad(
        selected.row,
        selected.col,
        selectedValue,
        givenMask[selected.row][selected.col],
        conflicts.has(cellKey(selected.row, selected.col)),
      ),
    [selected, selectedValue, givenMask, conflicts],
  );

  // Read the selected cell out on the Dot Pad's braille text line. Declared
  // before the announcement effect below so that when both fire in the same
  // commit (e.g. New Game resets both selection and announcement), the
  // announcement's text is sent last and wins.
  useEffect(() => {
    announceDotPadText(selectedCellLabel);
  }, [selectedCellLabel, dotPad.status]);

  // One-off events (win, new game) take priority over the cell readout above.
  useEffect(() => {
    if (announcement) announceDotPadText(announcement);
  }, [announcement]);

  // Mirror the whole board onto the Dot Pad's graphic area, one raw braille
  // cell per column (built directly with BrlToHex, no liblouis translation)
  // — an empty cell is dots 1-3-5, and the selected cell additionally gets
  // dot 6. Each row is padded out to the full 30-cell line width so it
  // starts a new physical line on the device. Kept in sync as the board's
  // values or selection change.
  const boardHex = useMemo(
    () =>
      entries
        .map((row, r) => buildRowHex(row, r === selected.row ? selected.col : -1))
        .join(''),
    [entries, selected],
  );

  useEffect(() => {
    displayDotPadGraphic(boardHex);
  }, [boardHex, dotPad.status]);

  const remainingCounts = useMemo(() => {
    const counts = Array(10).fill(9);
    for (const row of entries) {
      for (const value of row) {
        if (value !== 0) counts[value]--;
      }
    }
    return counts;
  }, [entries]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Sudoku</h1>
        <p className="subtitle">A fresh, easy puzzle every time.</p>
      </header>

      <div className="game-panel">
        <div className="status-bar">
          <span className="status-item" aria-hidden="true">
            ⏱ {formatTime(seconds)}
          </span>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setIsRunning((r) => !r)}
            disabled={won}
          >
            {isRunning ? 'Pause' : 'Resume'}
          </button>
          <button type="button" className="button button-primary" onClick={startNewGame}>
            New Game
          </button>
        </div>

        <div className="dotpad-panel">
          {dotPad.status === 'connected' ? (
            <div className="dotpad-connected">
              <span className="dotpad-status" role="status">
                Dot Pad connected{dotPad.device?.cellType ? ` (${dotPad.device.cellType})` : ''}
              </span>
              <button
                type="button"
                className="button button-secondary"
                onClick={dotPad.disconnect}
              >
                Disconnect Dot Pad
              </button>
            </div>
          ) : (
            <div className="dotpad-connect">
              <button
                type="button"
                className="button button-secondary"
                disabled={!dotPad.supported || dotPad.status === 'connecting'}
                aria-expanded={dotPadMenuOpen}
                onClick={() => setDotPadMenuOpen((open) => !open)}
              >
                {dotPad.status === 'connecting' ? 'Connecting to Dot Pad…' : 'Connect to Dot Pad'}
              </button>

              {dotPadMenuOpen && dotPad.status !== 'connecting' && (
                <div className="dotpad-menu" role="group" aria-label="Choose Dot Pad connection type">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => handleDotPadTransport('bluetooth')}
                  >
                    Connect via Bluetooth
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => handleDotPadTransport('usb')}
                  >
                    Connect via USB
                  </button>
                </div>
              )}

              {!dotPad.supported && (
                <p className="dotpad-hint">
                  Dot Pad connections need a Chromium-based browser (e.g. Chrome or Edge).
                </p>
              )}
              {dotPad.status === 'error' && (
                <p className="dotpad-hint dotpad-hint-error" role="alert">
                  {dotPad.error}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="board-wrapper">
          <div
            className={`board${isRunning ? '' : ' board-paused'}`}
            role="grid"
            aria-label="Sudoku board, 9 rows by 9 columns"
            aria-rowcount={9}
            aria-colcount={9}
            ref={boardRef}
          >
            {entries.map((rowValues, row) => (
              <div className="board-row" role="row" key={row}>
                {rowValues.map((value, col) => {
                  const isGiven = givenMask[row][col];
                  const isSelected = selected.row === row && selected.col === col;
                  const isPeer =
                    !isSelected &&
                    (selected.row === row ||
                      selected.col === col ||
                      (Math.floor(selected.row / 3) === Math.floor(row / 3) &&
                        Math.floor(selected.col / 3) === Math.floor(col / 3)));
                  const isSameValue =
                    !isSelected && value !== 0 && value === selectedValue;
                  const hasConflict = conflicts.has(cellKey(row, col));

                  const classNames = [
                    'cell',
                    isGiven ? 'cell-given' : 'cell-entry',
                    isSelected ? 'cell-selected' : '',
                    isPeer ? 'cell-peer' : '',
                    isSameValue ? 'cell-same-value' : '',
                    hasConflict ? 'cell-conflict' : '',
                    col % 3 === 0 ? 'cell-box-start-col' : '',
                    row % 3 === 0 ? 'cell-box-start-row' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  const label = describeCell(row, col, value, isGiven, hasConflict);

                  return (
                    <button
                      key={col}
                      type="button"
                      role="gridcell"
                      data-row={row}
                      data-col={col}
                      className={classNames}
                      aria-label={label}
                      aria-selected={isSelected}
                      aria-readonly={isGiven}
                      tabIndex={isSelected ? 0 : -1}
                      disabled={won && !isSelected}
                      onFocus={() => setSelected({ row, col })}
                      onClick={() => setSelected({ row, col })}
                      onKeyDown={(event) => handleCellKeyDown(event, row, col)}
                    >
                      {value !== 0 ? value : ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="number-pad" role="group" aria-label="Number entry pad">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((digit) => (
            <button
              key={digit}
              type="button"
              className="button number-button"
              aria-label={`Enter ${digit}${
                remainingCounts[digit] === 0 ? ' (all placed)' : ''
              }`}
              disabled={won || givenMask[selected.row][selected.col]}
              onClick={() => setCellValue(selected.row, selected.col, digit)}
            >
              <span aria-hidden="true">{digit}</span>
              <span className="number-remaining" aria-hidden="true">
                {remainingCounts[digit] > 0 ? remainingCounts[digit] : ''}
              </span>
            </button>
          ))}
          <button
            type="button"
            className="button number-button number-erase"
            aria-label="Erase cell"
            disabled={won || givenMask[selected.row][selected.col]}
            onClick={() => setCellValue(selected.row, selected.col, 0)}
          >
            Erase
          </button>
        </div>

        {won && (
          <div className="win-banner" role="status">
            🎉 Solved in {formatTime(seconds)}!
            <button type="button" className="button button-primary" onClick={startNewGame}>
              Play again
            </button>
          </div>
        )}
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      <footer className="app-footer">
        <p>
          Use arrow keys to move, number keys 1–9 to fill a cell, and Backspace or Delete to
          clear it.
        </p>
      </footer>
    </div>
  );
}
