import type { ComparisonRow, LessonPart, PartKey, Segment } from "@/lib/curriculum/lessons";

/** Shared pieces of the lesson page. No hooks, so both the server page and client blocks can use them. */

export function Mark({ part, children }: { part: PartKey; children: React.ReactNode }) {
  return <span className={`mark mark-${part}`}>{children}</span>;
}

/** Example text with each part highlighted. `slot` replaces the missing part (the faded example). */
export function ExampleText({ segments, layout, missing, slot }: { segments: Segment[]; layout: "inline" | "lines"; missing?: PartKey; slot?: React.ReactNode }) {
  const body = segments
    .filter((s) => layout === "inline" || s.text.trim() || s.part === missing)
    .map((s, i) => {
      if (missing && s.part === missing) return <span key={i} className="example-slot">{slot}</span>;
      const inner = s.part ? <Mark part={s.part}>{s.text}</Mark> : s.text;
      return layout === "lines" ? (
        <span key={i} className="example-line">
          {inner}
        </span>
      ) : (
        <span key={i}>{inner}</span>
      );
    });
  return <div className={`example-body${layout === "lines" ? " example-lines" : ""}`}>{body}</div>;
}

/** The colored key for an example, with what each part does. */
export function PartNotes({ parts }: { parts: LessonPart[] }) {
  return (
    <ul className="annot">
      {parts.map((p) => (
        <li key={p.key}>
          <Mark part={p.key}>{p.label}</Mark>
          <span>{p.note}</span>
        </li>
      ))}
    </ul>
  );
}

/** Model Arena lessons: what each model returned for the same prompt (all figures are estimates). */
export function Comparison({ rows }: { rows: ComparisonRow[] }) {
  return (
    <div className="compare">
      <table className="table">
        <thead>
          <tr>
            <th>Model</th>
            <th>What it returned</th>
            <th>Time</th>
            <th>Cost (est.)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.model}>
              <td><b>{r.model}</b></td>
              <td>{r.summary}</td>
              <td>{r.time}</td>
              <td>{r.cost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
