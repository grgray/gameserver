import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createGame, getGame, move } from './api';
import type { GameState } from './types';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const state: GameState = {
  id: 'abc',
  board: ['', '', '', '', '', '', '', '', ''],
  status: 'in_progress',
  turn: 'X',
};

describe('api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a two-player game with an empty body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(state, 201));

    const game = await createGame({ mode: 'human' });

    expect(game.id).toBe('abc');
    expect(fetchMock).toHaveBeenCalledWith('/games', { method: 'POST' });
  });

  it('creates a computer game with a JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(state, 201));

    await createGame({ mode: 'computer', level: 2, mark: 'O' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/games',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'computer', level: 2, mark: 'O' }),
      }),
    );
  });

  it('moves a cell', async () => {
    fetchMock.mockResolvedValue(jsonResponse(state));

    await move('abc', 5);

    expect(fetchMock).toHaveBeenCalledWith(
      '/games/abc/moves',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ cell: 5 }),
      }),
    );
  });

  it('throws ApiError with the server message on failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'game not found' }, 404));

    const err = await getGame('nope').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, message: 'game not found' });
  });
});
