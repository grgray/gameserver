function ClueGroup({ title, entries, direction, activeKey, onSelectClue }) {
  return (
    <div className="clue-group">
      <h3 id={`clue-heading-${direction}`}>{title}</h3>
      <ul aria-labelledby={`clue-heading-${direction}`}>
        {entries.map((entry) => {
          const key = `${direction}-${entry.number}`;
          const isActive = key === activeKey;
          return (
            <li key={key}>
              <button
                type="button"
                className={isActive ? "clue-item clue-item-active" : "clue-item"}
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelectClue(entry, direction)}
              >
                <span className="clue-number">{entry.number}.</span> {entry.clue}
                <span className="clue-length"> ({entry.answer_length})</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ClueList({ clues, activeKey, onSelectClue }) {
  return (
    <nav className="clue-list" aria-label="Crossword clues">
      <ClueGroup
        title="Across"
        entries={clues.across}
        direction="across"
        activeKey={activeKey}
        onSelectClue={onSelectClue}
      />
      <ClueGroup
        title="Down"
        entries={clues.down}
        direction="down"
        activeKey={activeKey}
        onSelectClue={onSelectClue}
      />
    </nav>
  );
}
