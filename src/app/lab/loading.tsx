/** Instant feedback while a Lab page loads its data. */
export default function Loading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="skeleton" style={{ width: 260, height: 32 }} />
      <div className="grid grid-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div className="skeleton" style={{ height: 72 }} />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="skeleton" style={{ height: 220 }} />
      </div>
      <span className="small muted">Loading…</span>
    </div>
  );
}
