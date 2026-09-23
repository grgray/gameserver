// Client for the Pentago backend (see pentago/backend/README.md). In
// development Vite proxies /games to the backend, REST and WebSocket alike.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function errorMessage(body, status) {
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) return detail.map((d) => d.msg).join("; ");
  return `The server returned an error (${status}).`;
}

async function request(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Could not reach the game server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(data, res.status));
  return data;
}

// Returns a seat: { game, playerToken, colors, joinCode }.
export function createGame({ mode, color, difficulty }) {
  return request("/games", { method: "POST", body: { mode, color, difficulty } });
}

export function joinGame(code) {
  return request("/games/join", { method: "POST", body: { code } });
}

export function getGame(gameId) {
  return request(`/games/${encodeURIComponent(gameId)}`);
}

// move: { row, col, rotation: { quadrant, direction } | null }
export function makeMove(gameId, token, move) {
  const body = { row: move.row, col: move.col };
  if (move.rotation) body.rotation = move.rotation;
  return request(`/games/${encodeURIComponent(gameId)}/moves`, { method: "POST", body, token });
}

// Streams a game's state: onState(game) runs on connect and after every
// change. Reconnects with backoff if the connection drops. Returns a
// function that stops watching.
export function watchGame(gameId, onState, { WebSocketImpl = globalThis.WebSocket } = {}) {
  let socket = null;
  let stopped = false;
  let retryDelay = 500;
  let retryTimer = null;

  function connect() {
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocketImpl(`${scheme}://${window.location.host}/games/${encodeURIComponent(gameId)}/ws`);
    socket.onopen = () => {
      retryDelay = 500;
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "state") onState(message.game);
      } catch {
        // Ignore anything that isn't a state message.
      }
    };
    socket.onclose = (event) => {
      if (stopped || event.code === 4404) return;
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 8000);
    };
  }

  connect();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    socket?.close();
  };
}
