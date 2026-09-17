export type CellValue = '' | 'black' | 'white';
export type Player = 'black' | 'white';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Winner = 'Black' | 'White' | 'Tie';

export interface Score {
  black: number;
  white: number;
  winner: Winner;
}

export interface GameState {
  id: string;
  board: CellValue[][];
  currentPlayer: Player;
  validMoves: [number, number][];
  difficulty: Difficulty;
  playAgainstComputer: boolean;
  gameOver: boolean;
  score: Score;
}

export interface NewGameOptions {
  difficulty: Difficulty;
  playAgainstComputer: boolean;
}
