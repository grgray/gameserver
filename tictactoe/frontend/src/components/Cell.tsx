import type { Mark } from '../types';

interface CellProps {
  index: number;
  value: '' | Mark;
  disabled: boolean;
  winner: boolean;
  onClick: () => void;
}

export function Cell({ index, value, disabled, winner, onClick }: CellProps) {
  const row = Math.floor(index / 3) + 1;
  const col = (index % 3) + 1;
  const label = value
    ? `Row ${row}, column ${col}, ${value}`
    : `Row ${row}, column ${col}, empty`;

  const className = ['cell', value ? `cell-${value.toLowerCase()}` : '', winner ? 'cell-winner' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled && !value) onClick();
      }}
    >
      {value}
    </button>
  );
}
