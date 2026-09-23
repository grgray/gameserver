import { useId, useState } from "react";

const MODES = [
  { value: "online", label: "Play a friend online", hint: "You get a code to share; they join from their own device." },
  { value: "computer", label: "Play the computer", hint: "The computer takes the other colour." },
  { value: "local", label: "Two players on this device", hint: "Take turns on one screen." },
];

// Start a new game or join a friend's. Both forms stay on screen together so
// a player who arrives with a join link sees the code ready to go.
export default function Lobby({ busy, initialJoinCode = "", onCreate, onJoin }) {
  const [mode, setMode] = useState("online");
  const [color, setColor] = useState("black");
  const [difficulty, setDifficulty] = useState("medium");
  const [code, setCode] = useState(initialJoinCode);
  const ids = useId();

  function handleCreate(event) {
    event.preventDefault();
    onCreate({ mode, color, difficulty });
  }

  function handleJoin(event) {
    event.preventDefault();
    if (code.trim()) onJoin(code.trim());
  }

  return (
    <div className="lobby">
      <section className="card" aria-labelledby={`${ids}-new`}>
        <h2 id={`${ids}-new`}>New game</h2>
        <form onSubmit={handleCreate}>
          <fieldset>
            <legend>Who are you playing?</legend>
            {MODES.map((m) => (
              <div className="choice" key={m.value}>
                <input
                  type="radio"
                  id={`${ids}-mode-${m.value}`}
                  name="mode"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                  aria-describedby={`${ids}-mode-${m.value}-hint`}
                />
                <label htmlFor={`${ids}-mode-${m.value}`}>{m.label}</label>
                <p className="hint" id={`${ids}-mode-${m.value}-hint`}>
                  {m.hint}
                </p>
              </div>
            ))}
          </fieldset>

          {mode !== "local" && (
            <div className="field">
              <label htmlFor={`${ids}-color`}>Your colour</label>
              <select id={`${ids}-color`} value={color} onChange={(e) => setColor(e.target.value)}>
                <option value="black">Black (moves first)</option>
                <option value="white">White</option>
              </select>
            </div>
          )}

          {mode === "computer" && (
            <div className="field">
              <label htmlFor={`${ids}-difficulty`}>Difficulty</label>
              <select id={`${ids}-difficulty`} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          )}

          <button type="submit" className="button" disabled={busy}>
            Start game
          </button>
        </form>
      </section>

      <section className="card" aria-labelledby={`${ids}-join`}>
        <h2 id={`${ids}-join`}>Join a friend&apos;s game</h2>
        <form onSubmit={handleJoin}>
          <div className="field">
            <label htmlFor={`${ids}-code`}>Join code</label>
            <input
              id={`${ids}-code`}
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
              maxLength={6}
              aria-describedby={`${ids}-code-hint`}
            />
            <p className="hint" id={`${ids}-code-hint`}>
              Six letters and numbers, from the friend who started the game.
            </p>
          </div>
          <button type="submit" className="button" disabled={busy || !code.trim()}>
            Join game
          </button>
        </form>
      </section>
    </div>
  );
}
