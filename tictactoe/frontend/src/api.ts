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
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export function createGame(options: NewGameOptions = {}): Promise<GameState> {
  if (!options.mode || options.mode === 'human') {
    return request<GameState>('/games', { method: 'POST' });
  }
  return request<GameState>('/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: options.mode,
      level: options.level,
      mark: options.mark,
    }),
  });
}

export function getGame(id: string): Promise<GameState> {
  return request<GameState>(`/games/${id}`);
}

export function move(id: string, cell: number): Promise<GameState> {
  return request<GameState>(`/games/${id}/moves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cell }),
  });
}
