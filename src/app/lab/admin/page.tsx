import { notFound, redirect } from "next/navigation";
import { LimitLog } from "@/components/LimitLog";
import { SampleTag } from "@/components/Tags";
import { Icon } from "@/design/icons";
import { Sheet } from "@/design/Sheet";
import { ALERT_LEVELS, budgetAlert } from "@/lib/coach/budget";
import { MODULE_INFO } from "@/lib/curriculum/course";
import { getExercise } from "@/lib/curriculum/exercises";
import { costSummary, overrideLog, periods, shortTokens, staffNames, tokens, usd, type CostSummary } from "@/lib/cost-data";
import { exerciseTitle } from "@/lib/instructor-data";
import { modelLabel } from "@/lib/models";
import { getViewer } from "@/lib/session";

/**
 * The admin cost view: spend against the monthly budget with alerts at 50%, 80% and 100%, spend per student,
 * tokens by model, cache hit rate, active students, top lessons, and the daily limit log.
 * Admin-only: anyone else gets a 404, as if the page did not exist. Totals only, never message content.
 */
export const metadata = { title: "Cost and usage · AI Lab" };

const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;
const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function AdminCost() {
  const v = await getViewer();
  if (!v) redirect("/");
  if (v.role !== "admin") notFound();

  const [summary, log, names] = await Promise.all([costSummary(), overrideLog(20), staffNames()]);
  const p = periods();

  return (
    <div className="ds-page st-page ad-page" data-testid="admin-cost">
      <Sheet>
        <header className="st-head ds-rise" style={rise(0)}>
          <div>
            <p className="ds-kicker">Admin console · Fall 2026</p>
            <h1 className="ds-sheet-title">Cost and usage</h1>
            <p className="st-meta">
              <span>
                This month, {day(p.month)} to {day(new Date())}
              </span>
              <SampleTag />
            </p>
          </div>
        </header>

        <Budget summary={summary} />
        <Numbers summary={summary} />
        <TopSpenders summary={summary} />
        <ByModel summary={summary} />
        <TopLessons summary={summary} />

        <section className="st-sec ds-rise" style={rise(6)} id="overrides" data-testid="override-log" aria-labelledby="overrides-h">
          <div className="st-sec-head">
            <h2 id="overrides-h">Daily limit changes</h2>
            {log.length > 0 && <span className="st-count ds-num">{log.length} logged</span>}
          </div>
          {log.length === 0 ? (
            <p className="st-text">No facilitator has changed a daily limit yet.</p>
          ) : (
            <LimitLog
              rows={log}
              testid="override-log-rows"
              student={(id) => ({ label: id, sub: `Section ${id.split("-")[1] ?? ""}` })}
              actor={(id) => names.get(id) ?? "Facilitator"}
            />
          )}
          <p className="st-fine st-foot">Facilitators change a limit for one student in their own sections, with a reason. Each change is also in the audit log</p>
        </section>

        <p className="st-fine ad-foot">Totals only. Message content never appears in this view, and students are shown by their pseudonymous IDs</p>
      </Sheet>
    </div>
  );
}

function Budget({ summary }: { summary: CostSummary }) {
  const alert = budgetAlert(summary.spend_usd, summary.cap_usd);
  const width = Math.min(100, Math.round(alert.share * 100));
  return (
    <section className="st-sec st-sec-first ds-rise" style={rise(1)} id="cost" data-testid="admin-budget" aria-labelledby="budget-h">
      <h2 id="budget-h">Monthly budget</h2>
      <p className="st-stat">
        <span className="st-stat-n ds-num" data-testid="admin-spend">
          {usd(summary.spend_usd)}
        </span>
        <span>
          spent of the {usd(summary.cap_usd)} cohort budget ({pct(alert.share)})
        </span>
      </p>
      <div className="ad-bar">
        <span className="ds-track" role="img" aria-label={`${pct(alert.share)} of the monthly budget spent`}>
          <i style={{ width: `${width}%` }} />
        </span>
        {ALERT_LEVELS.filter((l) => l < 100).map((l) => (
          <i key={l} className="ad-mark" style={{ left: `${l}%` }} aria-hidden />
        ))}
      </div>
      <p className="ad-alert" data-testid="budget-alert" data-level={alert.level}>
        <Icon name={alert.level === 0 ? "check" : "flag"} />
        <span>{alert.message}</span>
      </p>
      <p className="st-fine">Alerts at 50%, 80% and 100% of the budget. At 100% new coaching pauses, and attempts are scored after the budget resets</p>
    </section>
  );
}

function Numbers({ summary }: { summary: CostSummary }) {
  const t = summary.tokens;
  const all = t.input + t.output + t.cache_read + t.cache_write;
  return (
    <section className="st-sec ds-rise" style={rise(2)} data-testid="admin-numbers" aria-labelledby="numbers-h">
      <h2 id="numbers-h">This month</h2>
      <dl className="ds-rows st-kv ad-kv">
        <div className="ds-row">
          <dt>Spend to date</dt>
          <dd>
            <b className="ds-num">{usd(summary.spend_usd)}</b>
            <span>{tokens(summary.calls)} model calls</span>
          </dd>
        </div>
        <div className="ds-row">
          <dt>Active students</dt>
          <dd>
            <b className="ds-num" data-testid="admin-active">
              {summary.active_students} of {summary.students_total}
            </b>
            <span>Used the Lab in the last 7 days</span>
          </dd>
        </div>
        <div className="ds-row">
          <dt>Cache hit rate</dt>
          <dd>
            <b className="ds-num" data-testid="admin-cache">
              {pct(summary.cache_hit_rate)}
            </b>
            <span>Of input tokens read from the prompt cache</span>
          </dd>
        </div>
        <div className="ds-row">
          <dt>Tokens</dt>
          <dd>
            <b className="ds-num">{shortTokens(all)}</b>
            <span>Input, output and cache</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function TopSpenders({ summary }: { summary: CostSummary }) {
  return (
    <section className="st-sec ds-rise" style={rise(3)} data-testid="top-spenders" aria-labelledby="spenders-h">
      <h2 id="spenders-h">Spend per student</h2>
      {summary.top_spenders.length === 0 ? (
        <p className="st-text">No student has used the coach this month.</p>
      ) : (
        <ol className="ds-rows ad-rows">
          {summary.top_spenders.map((s) => (
            <li key={s.student_id} className="ds-row ad-row" data-testid="spender-row">
              <span className="ad-row-name">
                <b>{s.student_id}</b>
                <span>Section {s.section_id}</span>
              </span>
              <span className="ad-row-n ds-num">{shortTokens(s.tokens)} tokens</span>
              <span className="ad-row-cost ds-num">{usd(s.cost_usd)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="st-fine">The top {summary.top_spenders.length} this month. Students are shown by pseudonymous ID; admins do not see names</p>
    </section>
  );
}

function ByModel({ summary }: { summary: CostSummary }) {
  return (
    <section className="st-sec ds-rise" style={rise(4)} data-testid="tokens-by-model" aria-labelledby="models-h">
      <h2 id="models-h">Tokens by model</h2>
      <table className="ad-table">
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">Calls</th>
            <th scope="col">Input</th>
            <th scope="col">Output</th>
            <th scope="col">Cache read</th>
            <th scope="col">Cost</th>
          </tr>
        </thead>
        <tbody>
          {summary.by_model.map((m) => (
            <tr key={m.model}>
              <th scope="row">{modelLabel(m.model)}</th>
              <td data-label="Calls">{tokens(m.calls)}</td>
              <td data-label="Input">{shortTokens(m.input)}</td>
              <td data-label="Output">{shortTokens(m.output)}</td>
              <td data-label="Cache read">{shortTokens(m.cache_read)}</td>
              <td data-label="Cost">{usd(m.cost_usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TopLessons({ summary }: { summary: CostSummary }) {
  return (
    <section className="st-sec ds-rise" style={rise(5)} data-testid="top-lessons" aria-labelledby="lessons-h">
      <h2 id="lessons-h">Top lessons by usage</h2>
      {summary.top_lessons.length === 0 ? (
        <p className="st-text">No lesson task has used the coach this month.</p>
      ) : (
        <ol className="ds-rows ad-rows">
          {summary.top_lessons.map((l) => {
            const ex = getExercise(l.exercise_id);
            const mod = ex && "module" in ex && ex.module in MODULE_INFO ? MODULE_INFO[ex.module as keyof typeof MODULE_INFO] : null;
            return (
              <li key={l.exercise_id} className="ds-row ad-row" data-testid="lesson-row">
                <span className="ad-row-name">
                  <b>{exerciseTitle(l.exercise_id)}</b>
                  <span>
                    {mod ? `Module ${mod.number}, ${mod.title}` : "Practice"} · {l.students} students
                  </span>
                </span>
                <span className="ad-row-n ds-num">{shortTokens(l.tokens)} tokens</span>
                <span className="ad-row-cost ds-num">{usd(l.cost_usd)}</span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="st-fine">Practice tasks ranked by tokens this month, coaching and the model runs together</p>
    </section>
  );
}
