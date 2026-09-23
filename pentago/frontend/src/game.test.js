import {
  cellName,
  describeMove,
  describeStatus,
  hasFive,
  lastPlacedCell,
  placeMarble,
  quadrantAt,
  rotateBoard,
  rotatePoint,
} from "./game.js";

const empty = () => Array.from({ length: 6 }, () => Array(6).fill(null));

function fromRows(rows) {
  return rows.map((row) => [...row].map((ch) => (ch === "B" ? "black" : ch === "W" ? "white" : null)));
}

function game(overrides) {
  return {
    status: "in_progress",
    currentPlayer: "black",
    players: { black: { kind: "human", joined: true }, white: { kind: "human", joined: true } },
    ...overrides,
  };
}

describe("cells and quadrants", () => {
  it("names cells by column letter and row number", () => {
    expect(cellName(0, 0)).toBe("A1");
    expect(cellName(2, 4)).toBe("E3");
    expect(cellName(5, 5)).toBe("F6");
  });

  it("finds the quadrant a cell is in", () => {
    expect(quadrantAt(0, 0)).toBe("top-left");
    expect(quadrantAt(1, 4)).toBe("top-right");
    expect(quadrantAt(4, 2)).toBe("bottom-left");
    expect(quadrantAt(5, 5)).toBe("bottom-right");
  });
});

describe("rotation", () => {
  // Matches the backend's tests: top-left clockwise sends A1 to C1, anticlockwise to A3.
  it("turns a quadrant clockwise", () => {
    const board = fromRows(["BW....", "......", "......", "......", "......", "......"]);
    expect(rotateBoard(board, "top-left", "clockwise")).toEqual(
      fromRows(["..B...", "..W...", "......", "......", "......", "......"])
    );
  });

  it("turns a quadrant anticlockwise", () => {
    const board = fromRows(["BW....", "......", "......", "......", "......", "......"]);
    expect(rotateBoard(board, "top-left", "anticlockwise")).toEqual(
      fromRows(["......", "W.....", "B.....", "......", "......", "......"])
    );
  });

  it("leaves the other quadrants alone", () => {
    const board = fromRows(["B..W..", "......", "......", "...B.W", "......", "W....."]);
    expect(rotateBoard(board, "bottom-right", "clockwise")).toEqual(
      fromRows(["B..W..", "......", "......", ".....B", "......", "W....W"])
    );
  });

  it("does not move points outside the quadrant", () => {
    expect(rotatePoint(0, 0, "bottom-right", "clockwise")).toEqual([0, 0]);
  });

  it("finds where the last marble ended up", () => {
    const move = { player: "black", row: 2, col: 2, rotation: { quadrant: "top-left", direction: "clockwise" } };
    expect(lastPlacedCell(move)).toEqual([2, 0]);
    expect(lastPlacedCell({ ...move, rotation: null })).toEqual([2, 2]);
  });
});

describe("five in a row", () => {
  it("spots horizontal, vertical and diagonal lines", () => {
    expect(hasFive(fromRows(["BBBBB.", "......", "......", "......", "......", "......"]), "black")).toBe(true);
    expect(hasFive(fromRows(["......", "..W...", "..W...", "..W...", "..W...", "..W..."]), "white")).toBe(true);
    expect(hasFive(fromRows([".B....", "..B...", "...B..", "....B.", ".....B", "......"]), "black")).toBe(true);
    expect(hasFive(fromRows(["......", ".....B", "....B.", "...B..", "..B...", ".B...."]), "black")).toBe(true);
  });

  it("does not count four, or the other colour", () => {
    const board = fromRows(["BBBB.B", "......", "......", "......", "......", "......"]);
    expect(hasFive(board, "black")).toBe(false);
    expect(hasFive(placeMarble(board, 0, 4, "black"), "white")).toBe(false);
    expect(hasFive(placeMarble(board, 0, 4, "black"), "black")).toBe(true);
  });

  it("placeMarble does not change the original board", () => {
    const board = empty();
    placeMarble(board, 0, 0, "white");
    expect(board[0][0]).toBeNull();
  });
});

describe("wording", () => {
  it("describes a move with its rotation", () => {
    expect(
      describeMove({ player: "white", row: 2, col: 3, rotation: { quadrant: "top-left", direction: "clockwise" } })
    ).toBe("White placed at D3 and turned the top-left quadrant clockwise.");
  });

  it("describes a winning placement", () => {
    expect(describeMove({ player: "black", row: 0, col: 4, rotation: null })).toBe(
      "Black placed at E1, making five in a row."
    );
  });

  it("describes whose turn it is from the player's point of view", () => {
    expect(describeStatus(game(), ["black"])).toBe("Your turn, black.");
    expect(describeStatus(game(), ["white"])).toBe("Waiting for black to move.");
    expect(describeStatus(game(), ["black", "white"])).toBe("Black to move.");
    const vsComputer = game({ players: { black: { kind: "computer", joined: true }, white: { kind: "human", joined: true } } });
    expect(describeStatus(vsComputer, ["white"])).toBe("The computer is thinking as black.");
  });

  it("describes how the game ended", () => {
    expect(describeStatus(game({ status: "white_wins" }), ["white"])).toBe("White wins. You win!");
    expect(describeStatus(game({ status: "white_wins" }), ["black"])).toBe("White wins. Your opponent wins this one.");
    expect(describeStatus(game({ status: "black_wins" }), ["black", "white"])).toBe("Black wins!");
    expect(describeStatus(game({ status: "draw" }), ["black"])).toBe("The game is a draw.");
    expect(describeStatus(game({ status: "waiting_for_opponent" }), ["black"])).toBe("Waiting for an opponent to join.");
  });
});
