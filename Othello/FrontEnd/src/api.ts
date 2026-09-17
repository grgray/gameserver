import type { GameState, NewGameOptions } from './types';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `request failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) message = body.detail;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export function createGame(options: NewGameOptions): Promise<GameState> {
  return request<GameState>('/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      difficulty: options.difficulty,
      playAgainstComputer: options.playAgainstComputer,
    }),
  });
}

export function getGame(id: string): Promise<GameState> {
  return request<GameState>(`/games/${id}`);
}

export function makeMove(id: string, row: number, col: number): Promise<GameState> {
  return request<GameState>(`/games/${id}/moves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ row, col }),
  });
}
