import { Panel, RowLink } from "@/design/Structure";
import type { CapOverride } from "@/lib/cost-data";

const fmt = (n: number) => n.toLocaleString("en-US");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * The daily limit log as rows: old and new limit, the reason, who and when.
 * With a student link each row opens that student (blue title, chevron). Without one the rows open nothing.
 * Used on the facilitator console, the student page and the admin cost view.
 */
export function LimitLog({
  rows,
  student,
  actor,
  testid = "limit-log",
  bare = false,
}: {
  rows: CapOverride[];
  /** How to show the student, or omit on a page that is already about one student. */
  student?: (id: string) => { label: string; href?: string; sub?: string };
  actor: (id: string) => string;
  testid?: string;
  /** Only the list, with no panel around it (inside a fold). */
  bare?: boolean;
}) {
  const list = (
    <ol className={`ds-rows${bare ? " st-flush" : ""}`} data-testid={testid}>
      {rows.map((r) => {
        const who = student?.(r.student_id);
        const change = `${r.previous_tokens !== null ? `${fmt(r.previous_tokens)} to ${fmt(r.daily_tokens)}` : fmt(r.daily_tokens)} tokens a day`;
        const end = (
          <>
            {actor(r.actor)} · <time dateTime={r.created_at}>{day(r.created_at)}</time>
          </>
        );
        // With a student: the student is the title and the change leads the detail. Without: the change is the title.
        const title = who ? who.label : change;
        const meta = who ? (
          <>
            <span className="st-line">
              <b>{change}</b>
              {who.sub && !who.href ? ` · ${who.sub}` : ""}
            </span>
            <span className="st-line">{r.reason}</span>
          </>
        ) : (
          <span className="st-line">{r.reason}</span>
        );
        if (who?.href) {
          return (
            <li key={r.id} data-testid="limit-row">
              <RowLink href={who.href} className="st-limrow" title={title} meta={meta} end={end} />
            </li>
          );
        }
        return (
          <li key={r.id} className="ds-row st-row" data-testid="limit-row">
            <span className="st-row-main">
              <span className="st-row-title">{title}</span>
              <span className="st-row-meta">{meta}</span>
            </span>
            <span className="st-row-end">{end}</span>
          </li>
        );
      })}
    </ol>
  );
  return bare ? list : <Panel list>{list}</Panel>;
}
