import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Board } from './Board';

describe('Board accessibility', () => {
  it('has no detectable axe violations while in progress', async () => {
    const { container } = render(
      <Board
        board={['X', '', 'O', '', 'X', '', '', '', 'O']}
        status="in_progress"
        turn="O"
        winningLine={null}
        onCellClick={() => {}}
      />,
    );

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe violations when finished', async () => {
    const { container } = render(
      <Board
        board={['X', 'X', 'X', 'O', 'O', '', '', '', '']}
        status="x_won"
        winningLine={[0, 1, 2]}
        onCellClick={() => {}}
      />,
    );

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
