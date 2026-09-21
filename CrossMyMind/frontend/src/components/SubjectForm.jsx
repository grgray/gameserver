export default function SubjectForm({ subject, onSubjectChange, onSubmit, loading }) {
  return (
    <form
      className="subject-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (subject.trim() && !loading) onSubmit(subject.trim());
      }}
    >
      <label htmlFor="subject-input">Puzzle subject</label>
      <div className="subject-form-row">
        <input
          id="subject-input"
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="e.g. chess, space exploration"
          maxLength={100}
          disabled={loading}
          autoComplete="off"
        />
        <button type="submit" disabled={loading || !subject.trim()}>
          {loading ? "Generating…" : "Generate Puzzle"}
        </button>
      </div>
    </form>
  );
}
