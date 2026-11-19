/** A quiet loading state in the new look. It appears only after 200ms, so a fast page never flashes it. */
export default function Loading() {
  return (
    <div className="ds-page ds-loading" role="status" aria-busy="true">
      <span className="ds-sr">Loading</span>
      <div className="ds-progress" aria-hidden>
        <span className="ds-bone" style={{ width: 120, height: 14 }} />
        <span className="ds-track" />
        <span className="ds-bone" style={{ width: 72, height: 14 }} />
      </div>
      <div className="ds-work" aria-hidden>
        <div className="ds-sheet ds-sq">
          <span className="ds-bone" style={{ width: 96, height: 14 }} />
          <span className="ds-bone" style={{ width: "min(420px, 80%)", height: 30 }} />
          <span className="ds-bone" style={{ width: "min(560px, 100%)", height: 16 }} />
          <span className="ds-bone" style={{ width: "100%", height: 160, marginTop: 24 }} />
        </div>
      </div>
    </div>
  );
}
