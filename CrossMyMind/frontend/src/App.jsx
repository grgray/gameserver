import { useEffect, useMemo, useState, useCallback } from "react";
import SubjectForm from "./components/SubjectForm";
import CrosswordGrid from "./components/CrosswordGrid";
import ClueList from "./components/ClueList";
import { generatePuzzle } from "./api/puzzleClient";
import { buildWordMaps, activeWordKey, findFirstFillable } from "./utils/crossword";
import { useDotPad } from "./dotpad/useDotPad.js";
import { displayDotPadGraphic } from "./dotpad/dotpadClient.js";
import { BrlToHex } from "./dotpad/brailleHex.js";

function emptyAnswers(size) {
  return Array.from({ length: size }, () => Array(size).fill(""));
}

// Standard six-dot braille alphabet (Grade 1), dot numbers 1-6.
const LETTER_DOTS = {
  A: "1", B: "12", C: "14", D: "145", E: "15", F: "124", G: "1245",
  H: "125", I: "24", J: "245", K: "13", L: "123", M: "134", N: "1345",
  O: "135", P: "1234", Q: "12345", R: "1235", S: "234", T: "2345",
  U: "136", V: "1236", W: "2456", X: "1346", Y: "13456", Z: "1356",
};

// The Dot Pad's graphic area is 30 cells wide per line.
const GRAPHIC_LINE_WIDTH = 30;

// Builds one puzzle row's braille cells for the Dot Pad graphic area — a
// spacer cell between each grid cell so adjacent cells stay distinguishable
// by touch (same reasoning as Sudoku's buildRowHex): a blocked cell is all
// 8 dots raised, except when the cell directly below it (in the next row
// down, same column) is fillable — dots 7/8 sit at the bottom of the cell,
// right against the top of whatever's in the row below (rows are stacked
// with no gap), so raising them there would bleed into a letter cell's top
// dots. A filled cell with a typed letter shows that letter's braille
// pattern, and a filled-but-empty cell is blank. The selected cell always
// gets dots 7 and 8 added on top — on top of its letter's pattern if it
// has one, or alone if it's still empty. A spacer between two blocked
// cells repeats the cell to its left, so a run of boundary squares reads
// as one solid wall; a spacer next to a letter cell (on either side) stays
// blank, keeping letters legible. Padded out to the full line width so the
// next row starts a new physical line.
function buildRowHex(rowCells, answerRow, selectedCol, nextRowCells) {
  const cells = rowCells.map((cell, col) => {
    if (!cell.filled) {
      const belowIsFillable = Boolean(nextRowCells && nextRowCells[col].filled);
      return BrlToHex(belowIsFillable ? "123456" : "12345678");
    }
    const letter = answerRow[col];
    const dots = letter ? LETTER_DOTS[letter] || "" : "";
    return col === selectedCol ? BrlToHex(dots + "78") : BrlToHex(dots);
  });
  const interleaved = cells.flatMap((cell, i) => {
    if (i === cells.length - 1) return [cell];
    const bothBlocked = !rowCells[i].filled && !rowCells[i + 1].filled;
    return [cell, bothBlocked ? cell : "00"];
  });
  const rowHex = interleaved.join("");
  const usedCells = interleaved.length;
  const paddingCells = Math.max(0, GRAPHIC_LINE_WIDTH - usedCells);
  return rowHex + "00".repeat(paddingCells);
}

export default function App() {
  const [subject, setSubject] = useState("");
  const [puzzle, setPuzzle] = useState(null);
  const [userAnswers, setUserAnswers] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [direction, setDirection] = useState("across");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  const dotPad = useDotPad();
  const [dotPadMenuOpen, setDotPadMenuOpen] = useState(false);

  // Close the transport menu once a connection attempt resolves.
  useEffect(() => {
    if (dotPad.status !== "connecting") setDotPadMenuOpen(false);
  }, [dotPad.status]);

  const handleDotPadTransport = useCallback(
    (transport) => {
      dotPad.connect(transport);
    },
    [dotPad]
  );

  const maps = useMemo(
    () => (puzzle ? buildWordMaps(puzzle) : null),
    [puzzle]
  );

  const activeKey = useMemo(() => {
    if (!puzzle || !maps || !selectedCell) return null;
    return activeWordKey(selectedCell[0], selectedCell[1], direction, maps);
  }, [puzzle, maps, selectedCell, direction]);

  const activeWordCells = useMemo(() => {
    const set = new Set();
    if (maps && activeKey && maps.wordCells[activeKey]) {
      for (const [r, c] of maps.wordCells[activeKey]) {
        set.add(`${r}-${c}`);
      }
    }
    return set;
  }, [maps, activeKey]);

  const activeClue = useMemo(() => {
    if (!puzzle || !activeKey) return null;
    const [dir, numberStr] = activeKey.split("-");
    const number = Number(numberStr);
    const list = dir === "across" ? puzzle.clues.across : puzzle.clues.down;
    const entry = list.find((e) => e.number === number);
    return entry ? { ...entry, direction: dir } : null;
  }, [puzzle, activeKey]);

  async function handleGenerate(subjectValue) {
    setLoading(true);
    setError(null);
    setStatusMessage(`Generating a crossword about "${subjectValue}"…`);
    try {
      const data = await generatePuzzle(subjectValue);
      setPuzzle(data);
      setUserAnswers(emptyAnswers(data.size));
      const first = findFirstFillable(data);
      setSelectedCell(first);
      if (first) {
        const freshMaps = buildWordMaps(data);
        const [r, c] = first;
        setDirection(freshMaps.acrossWordAt[r][c] != null ? "across" : "down");
      }
      setStatusMessage(`Puzzle ready: ${data.clues.across.length} across and ${data.clues.down.length} down clues.`);
    } catch (err) {
      setError(err.message || "Something went wrong generating the puzzle.");
      setPuzzle(null);
      setStatusMessage("");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectCell(row, col, forceDirection, toggle) {
    if (!maps) return;
    setSelectedCell([row, col]);
    setDirection((d) => {
      const hasAcross = maps.acrossWordAt[row][col] != null;
      const hasDown = maps.downWordAt[row][col] != null;
      if (forceDirection && (forceDirection === "across" ? hasAcross : hasDown)) {
        return forceDirection;
      }
      if (toggle && hasAcross && hasDown) {
        return d === "across" ? "down" : "across";
      }
      const hasCurrent = d === "across" ? hasAcross : hasDown;
      if (hasCurrent) return d;
      return hasAcross ? "across" : "down";
    });
  }

  function handleCellChange(row, col, value) {
    setUserAnswers((prev) => {
      const next = prev.map((r) => r.slice());
      next[row][col] = value;
      return next;
    });
  }

  function handleSelectClue(entry, dir) {
    setSelectedCell([entry.row, entry.col]);
    setDirection(dir);
  }

  function handleReveal() {
    if (!puzzle) return;
    setUserAnswers(
      puzzle.grid.map((row) => row.map((cell) => (cell.filled ? cell.solution : "")))
    );
  }

  function handleRevealClue() {
    if (!puzzle || !maps || !activeKey) return;
    const cells = maps.wordCells[activeKey];
    if (!cells) return;
    setUserAnswers((prev) => {
      const next = prev.map((r) => r.slice());
      for (const [r, c] of cells) {
        next[r][c] = puzzle.grid[r][c].solution;
      }
      return next;
    });
  }

  // Mirror the whole grid onto the Dot Pad's graphic area, one raw braille
  // cell per grid cell (built directly with BrlToHex, no liblouis
  // translation). Kept in sync as the puzzle loads or the player's answers
  // change.
  const boardHex = useMemo(() => {
    if (!puzzle) return "";
    return puzzle.grid
      .map((row, r) =>
        buildRowHex(
          row,
          userAnswers[r],
          r === selectedCell?.[0] ? selectedCell[1] : -1,
          puzzle.grid[r + 1]
        )
      )
      .join("");
  }, [puzzle, userAnswers, selectedCell]);

  useEffect(() => {
    displayDotPadGraphic(boardHex);
  }, [boardHex, dotPad.status]);

  return (
    <div className="app">
      <header>
        <h1>Crossword Generator</h1>
        <p className="subtitle">Enter any subject and get a fresh 10x10 crossword.</p>
      </header>

      <SubjectForm
        subject={subject}
        onSubjectChange={setSubject}
        onSubmit={handleGenerate}
        loading={loading}
      />

      <div className="dotpad-panel">
        {dotPad.status === "connected" ? (
          <div className="dotpad-connected">
            <span className="dotpad-status" role="status">
              Dot Pad connected{dotPad.device?.cellType ? ` (${dotPad.device.cellType})` : ""}
            </span>
            <button type="button" className="button button-secondary" onClick={dotPad.disconnect}>
              Disconnect Dot Pad
            </button>
          </div>
        ) : (
          <div className="dotpad-connect">
            <button
              type="button"
              className="button button-secondary"
              disabled={!dotPad.supported || dotPad.status === "connecting"}
              aria-expanded={dotPadMenuOpen}
              onClick={() => setDotPadMenuOpen((open) => !open)}
            >
              {dotPad.status === "connecting" ? "Connecting to Dot Pad…" : "Connect to Dot Pad"}
            </button>

            {dotPadMenuOpen && dotPad.status !== "connecting" && (
              <div className="dotpad-menu" role="group" aria-label="Choose Dot Pad connection type">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => handleDotPadTransport("bluetooth")}
                >
                  Connect via Bluetooth
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => handleDotPadTransport("usb")}
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
            {dotPad.status === "error" && (
              <p className="dotpad-hint dotpad-hint-error" role="alert">
                {dotPad.error}
              </p>
            )}
          </div>
        )}
      </div>

      <div aria-live="polite" className="visually-hidden" role="status">
        {statusMessage}
      </div>
      <div aria-live="assertive" className="visually-hidden" role="alert">
        {error}
      </div>

      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="loading-banner">Generating your puzzle…</p>}

      {puzzle && maps && (
        <main className="puzzle-layout">
          <section aria-label="Crossword grid">
            <CrosswordGrid
              puzzle={puzzle}
              userAnswers={userAnswers}
              selectedCell={selectedCell}
              direction={direction}
              activeWordCells={activeWordCells}
              acrossWordAt={maps.acrossWordAt}
              downWordAt={maps.downWordAt}
              onSelectCell={handleSelectCell}
              onCellChange={handleCellChange}
            />
            <div className="grid-toolbar">
              <button type="button" className="button button-secondary" onClick={handleReveal}>
                Reveal Solution
              </button>
              <button
                type="button"
                className="button button-secondary"
                disabled={!activeKey}
                onClick={handleRevealClue}
              >
                Reveal Clue
              </button>
            </div>
            {activeClue && (
              <p className="active-clue" aria-live="polite">
                {activeClue.number} {activeClue.direction}: {activeClue.clue} (
                {activeClue.answer_length} letters)
              </p>
            )}
          </section>
          <ClueList clues={puzzle.clues} activeKey={activeKey} onSelectClue={handleSelectClue} />
        </main>
      )}
    </div>
  );
}
