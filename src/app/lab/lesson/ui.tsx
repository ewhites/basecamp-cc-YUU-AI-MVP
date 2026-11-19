import type { ComparisonRow, LessonPart, PartKey, Segment } from "@/lib/curriculum/lessons";

/** Shared pieces of the lesson page. No hooks, so both the server page and client blocks can use them. */

/** The example's parts in reading order, each with its label. Whitespace-only joins are dropped. */
export function exampleRows(segments: Segment[], parts: LessonPart[], missing?: PartKey): { part?: PartKey; label: string; text: string }[] {
  return segments
    .filter((s) => (s.part ? s.text.trim() || s.part === missing : s.text.trim()))
    .map((s) => ({ part: s.part, label: parts.find((p) => p.key === s.part)?.label ?? "", text: s.text }));
}

/**
 * The example as rows: the part's name on the left (fine print), its words on the right. Names the parts without
 * colour, so every word in a line looks the same.
 * - `slot` replaces the missing part (the faded example).
 * - `typed` shows only that many characters (the demo typing), with the caret after the last one.
 * - `marked` highlights each part's words (the demo's notes), 180ms apart in reading order.
 */
export function ExampleRows({
  segments,
  parts,
  missing,
  slot,
  typed,
  marked = false,
}: {
  segments: Segment[];
  parts: LessonPart[];
  missing?: PartKey;
  slot?: React.ReactNode;
  typed?: number;
  marked?: boolean;
}) {
  const rows = exampleRows(segments, parts, missing);
  // Where each row starts in the typed text (the slot row types nothing).
  const starts = rows.map((_, i) => rows.slice(0, i).reduce((n, r) => n + (missing && r.part === missing ? 0 : r.text.length), 0));
  const total = rows.reduce((n, r) => n + (missing && r.part === missing ? 0 : r.text.length), 0);
  // The caret sits in the last row that has started typing.
  const caretRow = typed === undefined || typed >= total ? -1 : Math.max(0, starts.filter((st) => st < typed).length - 1);
  return (
    <div className="ln-ex">
      {rows.map((r, i) => {
        if (missing && r.part === missing) {
          return (
            <div key={i} className="ln-ex-row is-slot">
              <span className="ln-ex-label">{r.label}</span>
              <div className="ln-ex-text">{slot}</div>
            </div>
          );
        }
        const left = typed === undefined ? Infinity : typed - starts[i]!;
        if (left <= 0 && i !== caretRow) return null;
        const shown = r.text.slice(0, Math.max(0, left));
        const typing = i === caretRow;
        return (
          <div key={i} className="ln-ex-row">
            <span className="ln-ex-label">{r.label}</span>
            <p className="ln-ex-text">
              {marked ? <mark style={{ "--n": i + 1 } as React.CSSProperties}>{shown}</mark> : shown}
              {typing && <span className="ln-caret" aria-hidden />}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** What each part does: the part's name, then one line. */
export function PartNotes({ parts }: { parts: LessonPart[] }) {
  return (
    <dl className="ln-notes">
      {parts.map((p) => (
        <div key={p.key}>
          <dt>{p.label}</dt>
          <dd>{p.note}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Model Arena lessons: what each model returned for the same prompt (all figures are estimates). Rows stack on phones. */
export function Comparison({ rows }: { rows: ComparisonRow[] }) {
  return (
    <table className="ln-compare">
      <thead>
        <tr>
          <th scope="col">Model</th>
          <th scope="col">What it returned</th>
          <th scope="col">Time</th>
          <th scope="col">Cost (est.)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.model}>
            <th scope="row">{r.model}</th>
            <td>{r.summary}</td>
            <td className="ds-num" data-label="Time">{r.time}</td>
            <td className="ds-num" data-label="Cost (est.)">{r.cost}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
