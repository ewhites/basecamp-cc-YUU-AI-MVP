import { Icon } from "@/design/icons";

/** "Sample data": plain small text (project rule: on every screen). No pill, no fill. */
export function SampleTag() {
  return (
    <span className="ds-note" title="Everything here is invented sample data. No real student data.">
      Sample data
    </span>
  );
}

/** "Simulated": plain small text on every simulated connection (project rule). */
export function SimulatedTag({ what }: { what?: string }) {
  return (
    <span className="ds-note" title="Simulated connection. In the pilot this connects to Year Up's real system.">
      Simulated{what ? `: ${what}` : ""}
    </span>
  );
}

/** An attempt's status as plain text with one icon, so it never relies on colour alone. */
export function StatusTag({ status }: { status: string }) {
  const map: Record<string, [string, "check" | "minus" | "clock" | "flag"]> = {
    scored: ["Scored", "check"],
    needs_review: ["Needs review", "minus"],
    pending_score: ["Score pending", "clock"],
    distress: ["Support flagged", "flag"],
  };
  const [label, icon] = map[status] ?? [status, "minus"];
  return (
    <span className="ds-status" data-status={status}>
      <Icon name={icon} />
      {label}
    </span>
  );
}
