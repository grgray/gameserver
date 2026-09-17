import type { Score } from '../types';

interface ScorePanelProps {
  score: Score;
}

export function ScorePanel({ score }: ScorePanelProps) {
  return (
    <dl className="score" aria-label="Score">
      <div className="score-item">
        <dt>Black</dt>
        <dd>{score.black}</dd>
      </div>
      <div className="score-item">
        <dt>White</dt>
        <dd>{score.white}</dd>
      </div>
    </dl>
  );
}
