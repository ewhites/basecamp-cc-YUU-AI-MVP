import Link from "next/link";
import type { CapOverride } from "@/lib/cost-data";

const fmt = (n: number) => n.toLocaleString("en-US");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * The daily limit log as rows: student (optional), old and new limit, the reason, who and when.
 * Used on the facilitator console, the student page and the admin cost view.
 */
export function LimitLog({
  rows,
  student,
  actor,
  testid = "limit-log",
}: {
  rows: CapOverride[];
  /** How to show the student, or omit on a page that is already about one student. */
  student?: (id: string) => { label: string; href?: string; sub?: string };
  actor: (id: string) => string;
  testid?: string;
}) {
  return (
    <ol className="st-lims" data-testid={testid}>
      {rows.map((r) => {
        const who = student?.(r.student_id);
        return (
          <li key={r.id} className="st-lim" data-testid="limit-row">
            {who && (
              <div className="st-lim-who">
                {who.href ? <Link href={who.href}>{who.label}</Link> : <b>{who.label}</b>}
                {who.sub && <span>{who.sub}</span>}
              </div>
            )}
            <div className="st-lim-what">
              <p className="ds-num">
                <b>
                  {r.previous_tokens !== null ? `${fmt(r.previous_tokens)} to ${fmt(r.daily_tokens)}` : fmt(r.daily_tokens)} tokens a day
                </b>
              </p>
              <p className="st-lim-reason">{r.reason}</p>
            </div>
            <p className="st-lim-when">
              <span>{actor(r.actor)}</span>
              <time dateTime={r.created_at}>{day(r.created_at)}</time>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
