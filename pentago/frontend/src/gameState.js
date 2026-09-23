// One reducer for everything the game screen shows. The server's game state
// is the single source of truth; the rest is presentation:
//
// - `pending`: the cell the player has picked but not yet sent (a move is
//   only sent once its rotation is chosen).
// - `spin`: a rotation being animated. While it runs, the board shows the
//   position just before the rotation, and any newer states from the server
//   wait in `queue` so a fast computer reply doesn't cut the animation short.
// - `announcement`: what the live region reads out. `id` changes with every
//   announcement so repeating the same words is still read out.

import { describeMove, describeStatus, placeMarble } from "./game.js";

export const initialState = {
  seat: null, // { gameId, token, colors, joinCode }
  game: null,
  pending: null, // { row, col }
  spin: null, // { board, quadrant, direction, next }
  queue: [],
  submitting: false,
  error: "",
  announcement: { text: "", id: 0 },
};

function announce(state, text) {
  return { ...state, announcement: { text, id: state.announcement.id + 1 } };
}

function describeArrival(prev, next, colors) {
  const parts = [];
  if (prev && prev.status === "waiting_for_opponent" && next.status !== "waiting_for_opponent") {
    parts.push("Your opponent has joined.");
  }
  if (prev && next.moveCount > prev.moveCount) parts.push(describeMove(next.lastMove));
  parts.push(describeStatus(next, colors));
  return parts.join(" ");
}

// The newest state already accepted, whether shown, mid-spin or queued.
function latestKnown(state) {
  if (state.queue.length) return state.queue[state.queue.length - 1];
  if (state.spin) return state.spin.next;
  return state.game;
}

function showState(state, next, animate) {
  const prev = state.game;
  const colors = state.seat?.colors ?? [];
  const base = { ...state, pending: null, submitting: false };
  const rotation = next.lastMove?.rotation;

  if (animate && prev && rotation && next.moveCount === prev.moveCount + 1) {
    const { row, col, player } = next.lastMove;
    return announce(
      {
        ...base,
        spin: {
          board: placeMarble(prev.board, row, col, player),
          quadrant: rotation.quadrant,
          direction: rotation.direction,
          next,
        },
      },
      describeArrival(prev, next, colors)
    );
  }
  return announce({ ...base, game: next, spin: null }, describeArrival(prev, next, colors));
}

export function reducer(state, action) {
  switch (action.type) {
    case "seated":
      return announce(
        { ...initialState, seat: action.seat, game: action.game, announcement: state.announcement },
        describeStatus(action.game, action.seat.colors)
      );

    case "left":
      return { ...initialState, announcement: state.announcement };

    case "received": {
      const next = action.game;
      if (!state.game || next.id !== state.game.id) return state;
      const known = latestKnown(state);
      if (next.moveCount < known.moveCount) return state;
      if (next.moveCount === known.moveCount && next.status === known.status) {
        // Nothing new for the board (e.g. the same state from both the move
        // response and the WebSocket), but keep player details current.
        return state.spin || state.queue.length ? state : { ...state, game: next };
      }
      if (state.spin) return { ...state, queue: [...state.queue, next] };
      return showState(state, next, action.animate);
    }

    case "spinFinished": {
      // `moveCount` names the spin being finished, so a late fallback timer
      // can't cut short the spin that followed it.
      if (!state.spin || state.spin.next.moveCount !== action.moveCount) return state;
      const shown = { ...state, game: state.spin.next, spin: null };
      if (!shown.queue.length) return shown;
      const [next, ...rest] = shown.queue;
      return showState({ ...shown, queue: rest }, next, action.animate);
    }

    case "cellChosen":
      return { ...state, pending: { row: action.row, col: action.col }, error: "" };

    case "cellCleared":
      return { ...state, pending: null };

    case "submitStarted":
      return { ...state, submitting: true, error: "" };

    case "submitFinished":
      return { ...state, submitting: false };

    case "submitFailed":
      return announce({ ...state, submitting: false, pending: null, error: action.error }, action.error);

    case "error":
      return announce({ ...state, error: action.error }, action.error);

    default:
      throw new Error(`unknown action ${action.type}`);
  }
}
