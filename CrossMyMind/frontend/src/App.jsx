import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SubjectForm from "./components/SubjectForm";
import CrosswordGrid from "./components/CrosswordGrid";
import ClueList from "./components/ClueList";
import HelpModal from "./components/HelpModal";
import { generatePuzzle } from "./api/puzzleClient";
import { buildWordMaps, activeWordKey, findFirstFillable, findNextFillable } from "./utils/crossword";
import { useDotPad } from "./dotpad/useDotPad.js";
import {
  displayDotPadGraphic,
  displayDotPadTextRaw,
  subscribeDotPadChord,
  translateDotPadText,
} from "./dotpad/dotpadClient.js";
import { BrlToHex } from "./dotpad/brailleHex.js";

// Fallback braille text line width (cells) used before a device is
// connected/its own numberBrailleCellColumns is known.
const DEFAULT_DOT_PAD_LINE_WIDTH = 20;

// localStorage key the current game is saved under. A single fixed key
// means saving overwrites any previous save, same as most simple save
// slots — there's only ever one saved game at a time.
const SAVE_STORAGE_KEY = "crossmymind-save";

function hasStoredSave() {
  try {
    return Boolean(localStorage.getItem(SAVE_STORAGE_KEY));
  } catch {
    return false;
  }
}

function emptyAnswers(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(""));
}

// Standard six-dot braille alphabet (Grade 1), dot numbers 1-6.
const LETTER_DOTS = {
  A: "1", B: "12", C: "14", D: "145", E: "15", F: "124", G: "1245",
  H: "125", I: "24", J: "245", K: "13", L: "123", M: "134", N: "1345",
  O: "135", P: "1234", Q: "12345", R: "1235", S: "234", T: "2345",
  U: "136", V: "1236", W: "2456", X: "1346", Y: "13456", Z: "1356",
};

// For letter entry, each Dot Pad button stands in for one braille dot
// position: Panning Left = dot 3, F1 = dot 2, F2 = dot 1, F3 = dot 4,
// F4 = dot 5, Panning Right = dot 6. Holding the buttons for a letter's
// dots together (as one chord — see subscribeDotPadChord) and releasing
// enters that letter, the same way a Perkins-style brailler works.
const DOT_TO_CHORD_TOKEN = { 1: "2", 2: "1", 3: "L", 4: "3", 5: "4", 6: "R" };

// Reverse of LETTER_DOTS: which letter a given Dot Pad chord spells, keyed
// by the same sorted-token chord string subscribeDotPadChord produces.
// E.g. T is dots 2345, which is buttons F1+PanningLeft+F3+F4 -> chord
// "134L" -> "T". Verified to have no collisions with each other or with
// the L/R/F1/F4 navigation chords above.
const CHORD_TO_LETTER = Object.fromEntries(
  Object.entries(LETTER_DOTS).map(([letter, dots]) => {
    const chord = dots
      .split("")
      .map((d) => DOT_TO_CHORD_TOKEN[d])
      .sort()
      .join("");
    return [chord, letter];
  })
);

// The Dot Pad's graphic area is 30 cells wide per line.
const GRAPHIC_LINE_WIDTH = 30;

// Boundary-cell dot pattern: all 8 dots raised, except when a fillable cell
// sits directly beneath it — dots 7/8 sit at the bottom of the cell, right
// against the top of whatever's in the row below (rows are stacked with no
// gap), so raising them there would bleed into a letter cell's top dots.
function boundaryHex(belowIsFillable) {
  return BrlToHex(belowIsFillable ? "123456" : "12345678");
}

// Builds one puzzle row's braille cells for the Dot Pad graphic area — a
// spacer cell between each grid cell so adjacent cells stay distinguishable
// by touch (same reasoning as Sudoku's buildRowHex): a blocked cell uses
// boundaryHex (see above). A filled cell with a typed letter shows that
// letter's braille pattern, and a filled-but-empty cell is blank. The
// selected cell always gets dots 7 and 8 added on top — on top of its
// letter's pattern if it has one, or alone if it's still empty. A spacer
// between two blocked cells repeats that boundary pattern, so a run of
// boundary squares reads as one solid wall — except the spacer sits one
// device-column off from both grid columns above it, so its own diagonal
// neighbors below are the *next* row's cells on either side of it; if
// either of those is fillable, its dots 7/8 would bleed diagonally into
// that letter cell's top corner, so it drops to dots 1-6 too. A spacer
// next to a letter cell (on either side) in its own row stays blank,
// keeping letters legible. Padded out to the full line width so the next
// row starts a new physical line.
function buildRowHex(rowCells, answerRow, selectedCol, nextRowCells) {
  const cells = rowCells.map((cell, col) => {
    if (!cell.filled) {
      const belowIsFillable = Boolean(nextRowCells && nextRowCells[col].filled);
      return boundaryHex(belowIsFillable);
    }
    const letter = answerRow[col];
    const dots = letter ? LETTER_DOTS[letter] || "" : "";
    return col === selectedCol ? BrlToHex(dots + "78") : BrlToHex(dots);
  });
  const interleaved = cells.flatMap((cell, i) => {
    if (i === cells.length - 1) return [cell];
    const bothBlocked = !rowCells[i].filled && !rowCells[i + 1].filled;
    if (!bothBlocked) return [cell, "00"];
    const belowDiagonalFillable = Boolean(
      nextRowCells && (nextRowCells[i].filled || nextRowCells[i + 1].filled)
    );
    return [cell, boundaryHex(belowDiagonalFillable)];
  });
  const rowHex = interleaved.join("");
  const usedCells = interleaved.length;
  const paddingCells = Math.max(0, GRAPHIC_LINE_WIDTH - usedCells);
  return rowHex + "00".repeat(paddingCells);
}

// Packs already-translated words (each { hex }, one braille cell per two hex
// chars) into fixed-width text-line "pages" without ever splitting a word
// across a page boundary: words are added to the current page, separated by
// a blank cell, until the next word wouldn't fit, then a new page starts. A
// single word longer than the line width gets a page of its own (and will
// be truncated on send — there's no narrower window to pan within a word).
// Each page is padded out to the full line width with blank cells so a
// shorter page fully overwrites whatever the previous page left displayed.
function paginateWords(words, lineWidth) {
  const pages = [];
  let current = [];
  let currentCells = 0;
  for (const word of words) {
    const wordCells = word.hex.length / 2;
    const wouldBeCells = current.length === 0 ? wordCells : currentCells + 1 + wordCells;
    if (current.length > 0 && wouldBeCells > lineWidth) {
      pages.push(current);
      current = [word];
      currentCells = wordCells;
    } else {
      current.push(word);
      currentCells = wouldBeCells;
    }
  }
  if (current.length > 0) pages.push(current);

  return pages.map((pageWords) => {
    const hex = pageWords.map((word) => word.hex).join("00");
    const paddingCells = Math.max(0, lineWidth - hex.length / 2);
    return hex + "00".repeat(paddingCells);
  });
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
  const [hasSavedGame, setHasSavedGame] = useState(hasStoredSave);

  const dotPad = useDotPad();
  const [dotPadMenuOpen, setDotPadMenuOpen] = useState(false);
  const gridRef = useRef(null);
  const helpDialogRef = useRef(null);

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

  // Shorter form for the Dot Pad's braille text line — "A"/"D" instead of
  // the spelled-out "across"/"down" used in the on-screen readout above,
  // but otherwise carrying the same information (including the letter
  // count).
  const activeClueForDotPad = useMemo(() => {
    if (!activeClue) return "";
    const dirLetter = activeClue.direction === "across" ? "A" : "D";
    return `${activeClue.number}${dirLetter}: ${activeClue.clue}. ${activeClue.answer_length} letters`;
  }, [activeClue]);

  const dotPadLineWidth = dotPad.device?.numberBrailleCellColumns || DEFAULT_DOT_PAD_LINE_WIDTH;

  // The currently active clue, translated word-by-word and packed into
  // fixed-width text-line "pages" that never split a word across a page
  // boundary (see paginateWords) — long clues run past the Dot Pad's text
  // line width, and panning below steps through these pages instead of a
  // raw cell-offset window.
  const [dotPadPages, setDotPadPages] = useState([]);
  const [dotPadPageIndex, setDotPadPageIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDotPadPageIndex(0);
    const words = activeClueForDotPad.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      setDotPadPages([]);
      return;
    }
    Promise.all(words.map((word) => translateDotPadText(word))).then((hexes) => {
      if (cancelled) return;
      const translatedWords = hexes.map((hex) => ({ hex })).filter((w) => w.hex);
      setDotPadPages(paginateWords(translatedWords, dotPadLineWidth));
    });
    return () => {
      cancelled = true;
    };
  }, [activeClueForDotPad, dotPad.status, dotPadLineWidth]);

  // Send whichever page the reader is currently on to the Dot Pad's
  // braille text line.
  useEffect(() => {
    displayDotPadTextRaw(dotPadPages[dotPadPageIndex] || "");
  }, [dotPadPages, dotPadPageIndex, dotPad.status]);

  async function handleGenerate(subjectValue) {
    setLoading(true);
    setError(null);
    setStatusMessage(`Generating a crossword about "${subjectValue}"…`);
    try {
      const data = await generatePuzzle(subjectValue);
      setPuzzle(data);
      setUserAnswers(emptyAnswers(data.rows, data.cols));
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

  function handleSave() {
    if (!puzzle) return;
    try {
      localStorage.setItem(
        SAVE_STORAGE_KEY,
        JSON.stringify({ subject, puzzle, userAnswers, selectedCell, direction })
      );
      setHasSavedGame(true);
      setError(null);
      setStatusMessage("Game saved.");
    } catch {
      setError("Could not save the game — your browser's local storage may be full or unavailable.");
    }
  }

  function handleLoad() {
    let saved;
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      saved = raw ? JSON.parse(raw) : null;
    } catch {
      saved = null;
    }
    if (!saved || !saved.puzzle) {
      setError("No saved game was found.");
      return;
    }

    setSubject(saved.subject || "");
    setPuzzle(saved.puzzle);
    setUserAnswers(saved.userAnswers || emptyAnswers(saved.puzzle.rows, saved.puzzle.cols));
    setError(null);

    const freshMaps = buildWordMaps(saved.puzzle);
    const cell = saved.selectedCell || findFirstFillable(saved.puzzle);
    setSelectedCell(cell);
    if (cell) {
      const [r, c] = cell;
      const savedDirectionStillValid =
        saved.direction === "across" ? freshMaps.acrossWordAt[r][c] != null : freshMaps.downWordAt[r][c] != null;
      setDirection(
        savedDirectionStillValid ? saved.direction : freshMaps.acrossWordAt[r][c] != null ? "across" : "down"
      );
    }
    setStatusMessage("Saved game loaded.");
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

  // Moves the grid selection the same way an arrow key does (skipping
  // blocked cells, forcing direction to match the axis moved along — see
  // CrosswordGrid's own ArrowUp/Down/Left/Right handling) and moves DOM
  // focus to match. Used by Dot Pad button navigation below; keyboard
  // arrow keys keep their own separate, unchanged code path in
  // CrosswordGrid.
  const moveGridSelection = useCallback(
    (dr, dc, forceDirection) => {
      if (!puzzle || !selectedCell) return;
      const next = findNextFillable(puzzle, selectedCell[0], selectedCell[1], dr, dc);
      if (!next) return;
      handleSelectCell(next[0], next[1], forceDirection, false);
      gridRef.current?.focusCell(next[0], next[1]);
    },
    [puzzle, selectedCell, maps]
  );

  // Enters a letter at the current selection and auto-advances, the same
  // way typing a letter into the focused cell's <input> does in
  // CrosswordGrid's handleChange — but driven by a decoded Dot Pad letter
  // chord instead of a DOM change event.
  const enterLetterFromDotPad = useCallback(
    (letter) => {
      if (!puzzle || !selectedCell) return;
      const [row, col] = selectedCell;
      handleCellChange(row, col, letter);
      const dr = direction === "down" ? 1 : 0;
      const dc = direction === "across" ? 1 : 0;
      const next = findNextFillable(puzzle, row, col, dr, dc);
      if (next) gridRef.current?.focusCell(next[0], next[1]);
    },
    [puzzle, selectedCell, direction]
  );

  // Clears a letter at the current selection, the same way pressing
  // Backspace does in CrosswordGrid's own key handler: clears the current
  // cell if it has a letter, otherwise steps back one cell in the current
  // direction and clears that instead. Driven by the all-six-dots chord
  // (see below) rather than a keyboard event.
  const handleDotPadBackspace = useCallback(() => {
    if (!puzzle || !selectedCell) return;
    const [row, col] = selectedCell;
    if (userAnswers[row][col]) {
      handleCellChange(row, col, "");
      return;
    }
    const dr = direction === "down" ? -1 : 0;
    const dc = direction === "across" ? -1 : 0;
    const prev = findNextFillable(puzzle, row, col, dr, dc);
    if (!prev) return;
    handleCellChange(prev[0], prev[1], "");
    handleSelectCell(prev[0], prev[1], direction, false);
    gridRef.current?.focusCell(prev[0], prev[1]);
  }, [puzzle, selectedCell, direction, userAnswers, maps]);

  const handleReveal = useCallback(() => {
    if (!puzzle) return;
    setUserAnswers(
      puzzle.grid.map((row) => row.map((cell) => (cell.filled ? cell.solution : "")))
    );
  }, [puzzle]);

  const handleRevealClue = useCallback(() => {
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
  }, [puzzle, maps, activeKey]);

  // Jumps the selection to the first cell of the currently active clue —
  // same as clicking that clue in the Across/Down list.
  const jumpToClueStart = useCallback(() => {
    if (!activeClue) return;
    handleSelectClue(activeClue, activeClue.direction);
  }, [activeClue]);

  // Dot Pad button navigation and letter entry, both driven by the same
  // chords: the lone Panning Left/Right and Function 1/4 buttons mirror
  // the Left/Right/Up/Down arrow keys, and held together, Panning
  // Left+F1/Panning Right+F4 instead pan the braille text line (see the
  // pagination effect above). F1+F4 together reveals the current clue,
  // Panning Left+Panning Right together reveals the whole solution (same
  // as the two Reveal buttons), and F1+Panning Left+F4 (dots 2-3-5) jumps
  // to the first cell of the current clue. All six dots together (no
  // letter uses all six) acts as Backspace. Any other chord is checked
  // against CHORD_TO_LETTER — holding the buttons for a letter's braille dots
  // together enters that letter, Perkins-brailler style.
  useEffect(() => {
    return subscribeDotPadChord((chord) => {
      switch (chord) {
        case "1L":
          setDotPadPageIndex((prev) => Math.max(0, prev - 1));
          return;
        case "4R":
          setDotPadPageIndex((prev) => Math.min(dotPadPages.length - 1, prev + 1));
          return;
        case "L":
          moveGridSelection(0, -1, "across");
          return;
        case "R":
          moveGridSelection(0, 1, "across");
          return;
        case "1":
          moveGridSelection(-1, 0, "down");
          return;
        case "4":
          moveGridSelection(1, 0, "down");
          return;
        case "1234LR":
          handleDotPadBackspace();
          return;
        case "14":
          handleRevealClue();
          return;
        case "LR":
          handleReveal();
          return;
        case "14L":
          jumpToClueStart();
          return;
        default: {
          const letter = CHORD_TO_LETTER[chord];
          if (letter) enterLetterFromDotPad(letter);
        }
      }
    });
  }, [
    moveGridSelection,
    enterLetterFromDotPad,
    handleDotPadBackspace,
    handleRevealClue,
    handleReveal,
    jumpToClueStart,
    dotPadPages,
  ]);

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
    gridRef.current?.focusCell(entry.row, entry.col);
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
        <h1>Cross My Mind</h1>
        <p className="subtitle">Enter any subject and get a fresh 15x10 crossword.</p>
      </header>

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

      <SubjectForm
        subject={subject}
        onSubjectChange={setSubject}
        onSubmit={handleGenerate}
        loading={loading}
      />

      <div aria-live="polite" aria-atomic="true" className="visually-hidden" role="status">
        {statusMessage}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="visually-hidden" role="alert">
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
              ref={gridRef}
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
            <p className="active-clue" role="status" aria-live="polite" aria-atomic="true">
              {activeClue
                ? `${activeClue.number} ${activeClue.direction}: ${activeClue.clue} (${activeClue.answer_length} letters)`
                : ""}
            </p>
          </section>
          <ClueList clues={puzzle.clues} activeKey={activeKey} onSelectClue={handleSelectClue} />
        </main>
      )}

      <div className="save-toolbar">
        <button type="button" className="button button-secondary" disabled={!puzzle} onClick={handleSave}>
          Save Game
        </button>
        <button type="button" className="button button-secondary" disabled={!hasSavedGame} onClick={handleLoad}>
          Load Game
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => helpDialogRef.current?.showModal()}
        >
          Help
        </button>
      </div>

      <HelpModal ref={helpDialogRef} />
    </div>
  );
}
