import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { findNextFillable } from "../utils/crossword";

// Mouse click toggles direction on a repeat click of the *same* cell.
// This can't be derived from `selectedCell` because focus (which fires
// before click) already moves selection there, so a plain ref tracks the
// truly-previous click independent of that focus-driven update.

function cellRefKey(row, col) {
  return `${row}-${col}`;
}

const CrosswordGrid = forwardRef(function CrosswordGrid(
  {
    puzzle,
    userAnswers,
    selectedCell,
    direction,
    activeWordCells,
    acrossWordAt,
    downWordAt,
    onSelectCell,
    onCellChange,
  },
  ref
) {
  const inputRefs = useRef({});
  const lastClickRef = useRef(null);

  const focusCell = (row, col) => {
    const el = inputRefs.current[cellRefKey(row, col)];
    if (el) el.focus();
  };

  // Exposed so callers outside the grid (Dot Pad button navigation in
  // App.jsx) can move DOM focus the same way arrow-key navigation does,
  // keeping on-screen focus/highlighting in sync regardless of input source.
  useImperativeHandle(ref, () => ({ focusCell }));

  // Move focus into the grid whenever a new puzzle is generated, so the
  // player can start typing immediately instead of landing back on the form.
  useEffect(() => {
    if (selectedCell) focusCell(selectedCell[0], selectedCell[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle]);

  const handleCellClick = (row, col) => {
    const prev = lastClickRef.current;
    lastClickRef.current = [row, col];
    const isRepeatClick = Boolean(prev && prev[0] === row && prev[1] === col);
    onSelectCell(row, col, isRepeatClick);
  };

  const handleKeyDown = (e, row, col) => {
    let next = null;
    let nextDirection = direction;

    switch (e.key) {
      case "ArrowUp":
        nextDirection = "down";
        next = findNextFillable(puzzle, row, col, -1, 0);
        break;
      case "ArrowDown":
        nextDirection = "down";
        next = findNextFillable(puzzle, row, col, 1, 0);
        break;
      case "ArrowLeft":
        nextDirection = "across";
        next = findNextFillable(puzzle, row, col, 0, -1);
        break;
      case "ArrowRight":
        nextDirection = "across";
        next = findNextFillable(puzzle, row, col, 0, 1);
        break;
      case "Backspace": {
        e.preventDefault();
        if (userAnswers[row][col]) {
          onCellChange(row, col, "");
        } else {
          const dr = direction === "down" ? -1 : 0;
          const dc = direction === "across" ? -1 : 0;
          const prev = findNextFillable(puzzle, row, col, dr, dc);
          if (prev) {
            onCellChange(prev[0], prev[1], "");
            onSelectCell(prev[0], prev[1], direction, false);
            focusCell(prev[0], prev[1]);
          }
        }
        return;
      }
      default:
        return;
    }

    if (next) {
      e.preventDefault();
      onSelectCell(next[0], next[1], nextDirection, false);
      focusCell(next[0], next[1]);
    }
  };

  const handleChange = (e, row, col) => {
    const raw = e.target.value.toUpperCase();
    const letter = raw.replace(/[^A-Z]/g, "").slice(-1) || "";
    onCellChange(row, col, letter);

    if (letter) {
      const dr = direction === "down" ? 1 : 0;
      const dc = direction === "across" ? 1 : 0;
      const next = findNextFillable(puzzle, row, col, dr, dc);
      if (next) focusCell(next[0], next[1]);
    }
  };

  return (
    <table
      className="crossword-grid"
      role="grid"
      aria-label={`${puzzle.size} by ${puzzle.size} crossword grid`}
    >
      <tbody>
        {puzzle.grid.map((rowCells, r) => (
          <tr role="row" key={r}>
            {rowCells.map((cell, c) => {
              if (!cell.filled) {
                return (
                  <td
                    key={c}
                    role="presentation"
                    aria-hidden="true"
                    className="cell cell-blocked"
                  />
                );
              }

              const isSelected = selectedCell && selectedCell[0] === r && selectedCell[1] === c;
              const isActiveWord = activeWordCells.has(cellRefKey(r, c));
              const across = acrossWordAt[r][c];
              const down = downWordAt[r][c];
              const labelParts = [`Row ${r + 1}, column ${c + 1}`];
              if (across != null) labelParts.push(`${across} across`);
              if (down != null) labelParts.push(`${down} down`);

              return (
                <td
                  key={c}
                  role="gridcell"
                  className={
                    "cell" +
                    (isActiveWord ? " cell-active-word" : "") +
                    (isSelected ? " cell-selected" : "")
                  }
                >
                  {cell.number != null && <span className="cell-number">{cell.number}</span>}
                  <input
                    ref={(el) => {
                      inputRefs.current[cellRefKey(r, c)] = el;
                    }}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    maxLength={1}
                    value={userAnswers[r][c] || ""}
                    aria-label={labelParts.join(", ")}
                    onFocus={(e) => {
                      e.target.select();
                      onSelectCell(r, c, null, false);
                    }}
                    onClick={() => handleCellClick(r, c)}
                    onChange={(e) => handleChange(e, r, c)}
                    onKeyDown={(e) => handleKeyDown(e, r, c)}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
});

export default CrosswordGrid;
