export function SampleTag() {
  return (
    <span className="tag tag-sample" title="Everything here is invented sample data. No real student data.">
      Sample data
    </span>
  );
}

export function SimulatedTag({ what }: { what?: string }) {
  return (
    <span className="tag tag-sim" title="Simulated connection. In the pilot this connects to Year Up's real system.">
      Simulated{what ? `: ${what}` : ""}
    </span>
  );
}

export function StatusTag({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    scored: ["tag-pass", "Scored"],
    needs_review: ["tag-warn", "Needs review"],
    pending_score: ["tag-info", "Score pending"],
    distress: ["tag-fail", "Support flagged"],
  };
  const [cls, label] = map[status] ?? ["tag-info", status];
  return <span className={`tag ${cls}`}>{label}</span>;
}
