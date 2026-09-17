import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  generatePuzzle,
  findConflicts,
  isBoardComplete,
} from './sudoku.js';
import { useDotPad } from './dotpad/useDotPad.js';
import { announceDotPadText } from './dotpad/dotpadClient.js';
import './App.css';

const SIZE = 9;

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

  const moveSelection = useCallback((row, col) => {
    const clampedRow = Math.max(0, Math.min(SIZE - 1, row));
    const clampedCol = Math.max(0, Math.min(SIZE - 1, col));
    setSelected({ row: clampedRow, col: clampedCol });
  }, []);

  const handleCellKeyDown = useCallback(
    (event, row, col) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          moveSelection(row - 1, col);
          break;
        case 'ArrowDown':
          event.preventDefault();
          moveSelection(row + 1, col);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          moveSelection(row, col - 1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          moveSelection(row, col + 1);
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
    [moveSelection, setCellValue],
  );

  // Keep DOM focus in sync with the selected cell (roving tabindex pattern).
  useEffect(() => {
    const node = boardRef.current?.querySelector(
      `[data-row="${selected.row}"][data-col="${selected.col}"]`,
    );
    node?.focus();
  }, [selected]);

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
