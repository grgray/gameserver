import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import App from "./App.jsx";
import { boardGraphicHex } from "./dotpad/boardGraphic.js";

// The Dot Pad SDK talks to Bluetooth/USB hardware; stand in a device whose
// connection status each test can set.
const dotPadMock = vi.hoisted(() => ({ status: "idle", displayGraphic: vi.fn() }));

vi.mock("./dotpad/useDotPad.js", () => ({
  useDotPad: () => ({
    device: null,
    status: dotPadMock.status,
    error: "",
    connect: vi.fn(),
    disconnect: vi.fn(),
    supported: true,
  }),
}));

vi.mock("./dotpad/dotpadClient.js", () => ({
  displayDotPadGraphic: dotPadMock.displayGraphic,
}));

class FakeWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  close() {}
  push(game) {
    this.onmessage?.({ data: JSON.stringify({ type: "state", game }) });
  }
}

const emptyBoard = () => Array.from({ length: 6 }, () => Array(6).fill(null));

function gameState(overrides = {}) {
  return {
    id: "g1",
    mode: "local",
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

function jsonResponse(status, body) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

let fetchMock;

beforeEach(() => {
  sessionStorage.clear();
  dotPadMock.status = "idle";
  dotPadMock.displayGraphic.mockClear();
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function startLocalGame(user) {
  fetchMock.mockReturnValueOnce(
    jsonResponse(201, { game: gameState(), playerToken: "tok", colors: ["black", "white"], joinCode: null })
  );
  await user.click(screen.getByLabelText("Two players on this device"));
  await user.click(screen.getByRole("button", { name: "Start game" }));
  await screen.findByText("Black to move.", { selector: ".status-line" });
}

describe("App", () => {
  it("puts the Dot Pad connect button at the top of the page", () => {
    render(<App />);
    const button = screen.getByRole("button", { name: "Connect to Dot Pad" });
    expect(button.closest("header")).not.toBeNull();
  });

  it("draws the board on a connected Dot Pad and redraws it after each move", async () => {
    dotPadMock.status = "connected";
    const user = userEvent.setup();
    render(<App />);

    // Lobby: the display is cleared.
    expect(dotPadMock.displayGraphic).toHaveBeenLastCalledWith("00".repeat(300));

    await startLocalGame(user);
    expect(dotPadMock.displayGraphic).toHaveBeenLastCalledWith(boardGraphicHex(emptyBoard()));

    const after = emptyBoard();
    after[0][0] = "white";
    FakeWebSocket.instances[0].push(
      gameState({
        board: after,
        currentPlayer: "black",
        moveCount: 1,
        lastMove: { player: "white", row: 0, col: 0, rotation: null },
      })
    );

    await screen.findByRole("button", { name: /^A1, white/ });
    expect(dotPadMock.displayGraphic).toHaveBeenLastCalledWith(boardGraphicHex(after));
  });

  it("shows a chosen piece on the Dot Pad before the rotation, then the rotated board", async () => {
    dotPadMock.status = "connected";
    const user = userEvent.setup();
    render(<App />);
    await startLocalGame(user);
    const sent = () => dotPadMock.displayGraphic.mock.calls.map(([hex]) => hex);

    const placed = emptyBoard();
    placed[2][2] = "black";
    await user.click(screen.getByRole("button", { name: /^C3, empty/ }));
    expect(sent().at(-1)).toBe(boardGraphicHex(placed));

    // Cancelling takes the piece back off.
    await user.keyboard("{Escape}");
    expect(sent().at(-1)).toBe(boardGraphicHex(emptyBoard()));

    await user.click(screen.getByRole("button", { name: /^C3, empty/ }));
    const rotated = emptyBoard();
    rotated[2][0] = "black";
    fetchMock.mockReturnValueOnce(
      jsonResponse(200, gameState({
        board: rotated,
        currentPlayer: "white",
        moveCount: 1,
        lastMove: { player: "black", row: 2, col: 2, rotation: { quadrant: "top-left", direction: "clockwise" } },
      }))
    );
    await user.click(screen.getByRole("button", { name: "Turn top-left quadrant clockwise" }));
    await screen.findByRole("button", { name: "A3, black, last move" });

    const empty = boardGraphicHex(emptyBoard());
    // Lobby, game start, placed, cancelled, placed again, rotated: each sent once.
    expect(sent()).toEqual([
      "00".repeat(300),
      empty,
      boardGraphicHex(placed),
      empty,
      boardGraphicHex(placed),
      boardGraphicHex(rotated),
    ]);
  });

  it("leaves the Dot Pad alone when none is connected", async () => {
    const user = userEvent.setup();
    render(<App />);
    await startLocalGame(user);

    expect(dotPadMock.displayGraphic).not.toHaveBeenCalled();
  });

  it("has no detectable accessibility problems in the lobby", async () => {
    const { container } = render(<App />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("creates a game with the chosen options", async () => {
    const user = userEvent.setup();
    render(<App />);
    fetchMock.mockReturnValueOnce(
      jsonResponse(201, {
        game: gameState({ mode: "computer", difficulty: "hard" }),
        playerToken: "tok",
        colors: ["white"],
        joinCode: null,
      })
    );

    await user.click(screen.getByLabelText("Play the computer"));
    await user.selectOptions(screen.getByLabelText("Your colour"), "white");
    await user.selectOptions(screen.getByLabelText("Difficulty"), "hard");
    await user.click(screen.getByRole("button", { name: "Start game" }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/games");
    expect(JSON.parse(init.body)).toEqual({ mode: "computer", color: "white", difficulty: "hard" });
    expect(await screen.findByText(/You are playing white/)).toBeInTheDocument();
    expect(FakeWebSocket.instances[0].url).toMatch(/\/games\/g1\/ws$/);
  });

  it("plays a move from the keyboard: arrows, Enter, then a turn button", async () => {
    const user = userEvent.setup();
    render(<App />);
    await startLocalGame(user);

    screen.getByRole("button", { name: /^A1, empty/ }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("button", { name: /^C3, empty/ })).toHaveFocus();

    await user.keyboard("{Enter}");
    const turn = screen.getByRole("button", { name: "Turn top-left quadrant clockwise" });
    expect(turn).toHaveFocus();
    expect(screen.getByRole("button", { name: /^C3, black, chosen/ })).toBeInTheDocument();

    const after = emptyBoard();
    after[2][0] = "black";
    fetchMock.mockReturnValueOnce(
      jsonResponse(200, gameState({
        board: after,
        currentPlayer: "white",
        moveCount: 1,
        lastMove: { player: "black", row: 2, col: 2, rotation: { quadrant: "top-left", direction: "clockwise" } },
      }))
    );
    await user.keyboard("{Enter}");

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/games/g1/moves");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({
      row: 2,
      col: 2,
      rotation: { quadrant: "top-left", direction: "clockwise" },
    });
    expect(await screen.findByRole("button", { name: "A3, black, last move" })).toBeInTheDocument();
    expect(document.querySelector("[aria-live=polite]")).toHaveTextContent(
      "Black placed at C3 and turned the top-left quadrant clockwise. White to move."
    );
  });

  it("Escape cancels the chosen cell and returns focus to the board", async () => {
    const user = userEvent.setup();
    render(<App />);
    await startLocalGame(user);

    await user.click(screen.getByRole("button", { name: /^D4, empty/ }));
    expect(screen.getByRole("button", { name: "Turn top-left quadrant clockwise" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Turn top-left quadrant clockwise" })).toBeNull();
    expect(screen.getByRole("button", { name: /^D4, empty/ })).toHaveFocus();
  });

  it("offers a winning placement without a rotation", async () => {
    const user = userEvent.setup();
    render(<App />);
    const board = emptyBoard();
    for (let c = 0; c < 4; c++) board[0][c] = "black";
    fetchMock.mockReturnValueOnce(
      jsonResponse(201, { game: gameState({ board }), playerToken: "tok", colors: ["black", "white"], joinCode: null })
    );
    await user.click(screen.getByLabelText("Two players on this device"));
    await user.click(screen.getByRole("button", { name: "Start game" }));

    await user.click(await screen.findByRole("button", { name: /^E1, empty/ }));
    fetchMock.mockReturnValueOnce(jsonResponse(200, gameState({ board, status: "black_wins" })));
    await user.click(screen.getByRole("button", { name: "Place at E1 and win" }));

    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ row: 0, col: 4 });
  });

  it("shows live moves pushed over the WebSocket", async () => {
    const user = userEvent.setup();
    render(<App />);
    await startLocalGame(user);

    const after = emptyBoard();
    after[5][5] = "black";
    FakeWebSocket.instances[0].push(
      gameState({
        board: after,
        currentPlayer: "white",
        moveCount: 1,
        lastMove: { player: "black", row: 5, col: 5, rotation: { quadrant: "top-left", direction: "clockwise" } },
      })
    );

    expect(await screen.findByRole("button", { name: "F6, black, last move" })).toBeInTheDocument();
    expect(screen.getByText("White to move.", { selector: ".status-line" })).toBeInTheDocument();
  });

  it("explains a join code that doesn't work", async () => {
    const user = userEvent.setup();
    render(<App />);
    fetchMock.mockReturnValueOnce(jsonResponse(404, { detail: "no game is waiting for that join code" }));

    await user.type(screen.getByLabelText("Join code"), "abc234");
    await user.click(screen.getByRole("button", { name: "Join game" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No game is waiting for the code ABC234");
  });

  it("fills in the join code from a shared link", () => {
    window.history.replaceState(null, "", "/?join=k7qm3r");
    render(<App />);
    expect(screen.getByLabelText("Join code")).toHaveValue("K7QM3R");
  });

  it("shows the join code while waiting for an opponent", async () => {
    const user = userEvent.setup();
    render(<App />);
    fetchMock.mockReturnValueOnce(
      jsonResponse(201, {
        game: gameState({ mode: "online", status: "waiting_for_opponent", players: {
          black: { kind: "human", joined: true },
          white: { kind: "human", joined: false },
        } }),
        playerToken: "tok",
        colors: ["black"],
        joinCode: "K7QM3R",
      })
    );
    await user.click(screen.getByRole("button", { name: "Start game" }));

    expect(await screen.findByText("K 7 Q M 3 R")).toBeInTheDocument();
    expect(screen.getByText(/\?join=K7QM3R$/)).toBeInTheDocument();
  });

  it("has no detectable accessibility problems during a game", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await startLocalGame(user);
    await user.click(screen.getByRole("button", { name: /^B2, empty/ }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
