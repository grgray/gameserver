import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { GameState } from './types';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'abc',
    board: ['', '', '', '', '', '', '', '', ''],
    status: 'in_progress',
    turn: 'X',
    ...overrides,
  };
}

describe('App', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts a game and plays a move', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(state(), 201))
      .mockResolvedValueOnce(
        jsonResponse(
          state({ board: ['X', '', '', '', '', '', '', '', ''], turn: 'O' }),
        ),
      );

    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /start game/i }));

    const cell = await screen.findByRole('button', {
      name: /row 1, column 1, empty/i,
    });
    await user.click(cell);

    expect(fetchMock).toHaveBeenCalledWith(
      '/games/abc/moves',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ cell: 1 }),
      }),
    );
  });

  it('announces the winner when the game is won', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        state({
          board: ['X', 'X', 'X', 'O', 'O', '', '', '', ''],
          status: 'x_won',
          winner: 'X',
          turn: undefined,
        }),
        201,
      ),
    );

    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /start game/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('X wins!');
  });
});
