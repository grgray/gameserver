export type Mark = 'X' | 'O';
export type Mode = 'human' | 'computer';
export type Level = 1 | 2;
export type Status = 'in_progress' | 'x_won' | 'o_won' | 'draw';

export interface GameState {
  id: string;
  board: ('' | Mark)[];
  turn?: Mark;
  status: Status;
  winner?: Mark;
  mode?: Mode;
  level?: Level;
  mark?: Mark;
}

export interface NewGameOptions {
  mode?: Mode;
  level?: Level;
  mark?: Mark;
}
