import { initialState, reducer } from "./gameState.js";

const emptyBoard = () => Array.from({ length: 6 }, () => Array(6).fill(null));

function state0(overrides = {}) {
  return {
    id: "g1",
    mode: "online",
    status: "in_progress",
    board: emptyBoard(),
    currentPlayer: "black",
    moveCount: 0,
    lastMove: null,
    winningLines: [],
    players: { black: { kind: "human", joined: true }, white: { kind: "human", joined: true } },
    difficulty: null,
    ...overrides,
  };
}

// Black at A1 turned top-left clockwise ends up at C1.
function afterBlackMove() {
  const board = emptyBoard();
  board[0][2] = "black";
  return state0({
    board,
    currentPlayer: "white",
    moveCount: 1,
    lastMove: { player: "black", row: 0, col: 0, rotation: { quadrant: "top-left", direction: "clockwise" } },
  });
}

function afterWhiteMove() {
  const board = emptyBoard();
  board[0][2] = "black";
  board[5][5] = "white";
  return state0({
    board,
    currentPlayer: "black",
    moveCount: 2,
    lastMove: { player: "white", row: 5, col: 5, rotation: { quadrant: "bottom-left", direction: "clockwise" } },
  });
}

function seated(game = state0(), colors = ["black"]) {
  return reducer(initialState, {
    type: "seated",
    seat: { gameId: game.id, token: "t", colors, joinCode: null },
    game,
  });
}

describe("reducer", () => {
  it("announces whose turn it is when seated", () => {
    const state = seated();
    expect(state.game.id).toBe("g1");
    expect(state.announcement.text).toBe("Your turn, black.");
  });

  it("shows a new state straight away when not animating", () => {
    const state = reducer(seated(), { type: "received", game: afterBlackMove(), animate: false });
    expect(state.game.moveCount).toBe(1);
    expect(state.spin).toBeNull();
    expect(state.announcement.text).toBe(
      "Black placed at A1 and turned the top-left quadrant clockwise. Waiting for white to move."
    );
  });

  it("spins from the placed-but-unturned board when animating", () => {
    const state = reducer(seated(), { type: "received", game: afterBlackMove(), animate: true });
    expect(state.game.moveCount).toBe(0);
    expect(state.spin.quadrant).toBe("top-left");
    expect(state.spin.direction).toBe("clockwise");
    expect(state.spin.board[0][0]).toBe("black");

    const done = reducer(state, { type: "spinFinished", moveCount: 1, animate: true });
    expect(done.spin).toBeNull();
    expect(done.game.board[0][2]).toBe("black");
  });

  it("queues a state that arrives mid-spin and spins it next", () => {
    let state = reducer(seated(), { type: "received", game: afterBlackMove(), animate: true });
    state = reducer(state, { type: "received", game: afterWhiteMove(), animate: true });
    expect(state.queue).toHaveLength(1);
    expect(state.spin.next.moveCount).toBe(1);

    state = reducer(state, { type: "spinFinished", moveCount: 1, animate: true });
    expect(state.queue).toHaveLength(0);
    expect(state.game.moveCount).toBe(1);
    expect(state.spin.next.moveCount).toBe(2);
  });

  it("ignores a stale spinFinished", () => {
    let state = reducer(seated(), { type: "received", game: afterBlackMove(), animate: true });
    state = reducer(state, { type: "received", game: afterWhiteMove(), animate: true });
    state = reducer(state, { type: "spinFinished", moveCount: 1, animate: true });

    const again = reducer(state, { type: "spinFinished", moveCount: 1, animate: true });
    expect(again).toBe(state);
  });

  it("ignores duplicates and older states", () => {
    const shown = reducer(seated(), { type: "received", game: afterBlackMove(), animate: false });
    const dup = reducer(shown, { type: "received", game: afterBlackMove(), animate: false });
    expect(dup.announcement).toBe(shown.announcement);

    const older = reducer(shown, { type: "received", game: state0(), animate: false });
    expect(older).toBe(shown);
  });

  it("ignores states for another game", () => {
    const state = seated();
    expect(reducer(state, { type: "received", game: state0({ id: "other", moveCount: 3 }), animate: false })).toBe(state);
  });

  it("announces an opponent joining", () => {
    const waiting = seated(state0({ status: "waiting_for_opponent" }));
    const state = reducer(waiting, { type: "received", game: state0(), animate: false });
    expect(state.announcement.text).toBe("Your opponent has joined. Your turn, black.");
  });

  it("clears the chosen cell when a move arrives", () => {
    let state = reducer(seated(), { type: "cellChosen", row: 1, col: 1 });
    expect(state.pending).toEqual({ row: 1, col: 1 });
    state = reducer(state, { type: "received", game: afterBlackMove(), animate: false });
    expect(state.pending).toBeNull();
  });

  it("reports a failed move and forgets the chosen cell", () => {
    let state = reducer(seated(), { type: "cellChosen", row: 1, col: 1 });
    state = reducer(state, { type: "submitStarted" });
    state = reducer(state, { type: "submitFailed", error: "cell (1, 1) is already occupied" });
    expect(state.submitting).toBe(false);
    expect(state.pending).toBeNull();
    expect(state.error).toBe("cell (1, 1) is already occupied");
    expect(state.announcement.text).toBe("cell (1, 1) is already occupied");
  });

  it("gives a repeated announcement a new id so it is read again", () => {
    const a = reducer(seated(), { type: "error", error: "Oops" });
    const b = reducer(a, { type: "error", error: "Oops" });
    expect(b.announcement.text).toBe(a.announcement.text);
    expect(b.announcement.id).not.toBe(a.announcement.id);
  });
});
