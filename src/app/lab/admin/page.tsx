import { notFound, redirect } from "next/navigation";
import { LimitLog } from "@/components/LimitLog";
import { SampleTag } from "@/components/Tags";
import { Icon } from "@/design/icons";
import { Sheet } from "@/design/Sheet";
import { Fold, Panel, Section } from "@/design/Structure";
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

/** Rows shown before a "Show all" fold. */
const SHOWN = 5;
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
    <div className="ds-page st-page st-narrow ad-page" data-testid="admin-cost">
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

        <Section
          title="Daily limit changes"
          id="overrides"
          data-testid="override-log"
          className="ds-rise"
          style={rise(6)}
          aside={log.length > 0 ? `${log.length} logged` : undefined}
        >
          {log.length === 0 ? (
            <Panel>
              <p>No facilitator has changed a daily limit yet.</p>
            </Panel>
          ) : (
            <>
              <LimitLog
                rows={log.slice(0, SHOWN)}
                testid="override-log-rows"
                student={(id) => ({ label: id, sub: `Section ${id.split("-")[1] ?? ""}` })}
                actor={(id) => names.get(id) ?? "Facilitator"}
              />
              {log.length > SHOWN && (
                <Fold label={`Show all ${log.length}`}>
                  <LimitLog
                    bare
                    rows={log.slice(SHOWN)}
                    testid="override-log-more"
                    student={(id) => ({ label: id, sub: `Section ${id.split("-")[1] ?? ""}` })}
                    actor={(id) => names.get(id) ?? "Facilitator"}
                  />
                </Fold>
              )}
            </>
          )}
        </Section>

        <Fold label="What this view never shows" className="st-foldend">
          <p>Totals only. Message content never appears here, and students are shown by pseudonymous ID, so admins do not see names.</p>
          <p>Facilitators change a limit for one student in their own sections, with a reason. Each change is also in the audit log.</p>
        </Fold>
      </Sheet>
    </div>
  );
}

function Budget({ summary }: { summary: CostSummary }) {
  const alert = budgetAlert(summary.spend_usd, summary.cap_usd);
  const width = Math.min(100, Math.round(alert.share * 100));
  return (
    <Section title="Monthly budget" id="cost" data-testid="admin-budget" className="ds-rise" style={rise(1)}>
      <Panel className="st-stack">
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
      </Panel>
      <Fold label="How budget alerts work">
        <p>Alerts at 50%, 80% and 100% of the budget. At 100% new coaching pauses, and attempts are scored after the budget resets.</p>
      </Fold>
    </Section>
  );
}

function Numbers({ summary }: { summary: CostSummary }) {
  const t = summary.tokens;
  const all = t.input + t.output + t.cache_read + t.cache_write;
  return (
    <Section title="This month" id="numbers" data-testid="admin-numbers" className="ds-rise" style={rise(2)}>
      <Panel list>
        <dl className="ds-rows st-kv ad-kv">
          <div className="ds-row">
            <dt>Model calls</dt>
            <dd>
              <b className="ds-num">{tokens(summary.calls)}</b>
              <span>Coaching and model runs</span>
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
      </Panel>
    </Section>
  );
}

/** Ranked rows open nothing (admins see totals only), so they have no blue and no chevron. */
function RankRow({ name, sub, n, cost, testid }: { name: string; sub: string; n: string; cost: string; testid: string }) {
  return (
    <li className="ds-row st-row" data-testid={testid}>
      <span className="st-row-main">
        <span className="st-row-title">{name}</span>
        <span className="st-row-meta">{sub}</span>
      </span>
      <span className="st-row-end ad-row-n ds-num">{n}</span>
      <span className="st-row-end ad-row-cost ds-num">{cost}</span>
    </li>
  );
}

function TopSpenders({ summary }: { summary: CostSummary }) {
  const rows = summary.top_spenders;
  const row = (s: (typeof rows)[number]) => (
    <RankRow key={s.student_id} testid="spender-row" name={s.student_id} sub={`Section ${s.section_id}`} n={`${shortTokens(s.tokens)} tokens`} cost={usd(s.cost_usd)} />
  );
  return (
    <Section title="Spend per student" id="spenders" data-testid="top-spenders" className="ds-rise" style={rise(3)} aside={rows.length > 0 ? `Top ${rows.length}` : undefined}>
      {rows.length === 0 ? (
        <Panel>
          <p>No student has used the coach this month.</p>
        </Panel>
      ) : (
        <>
          <Panel list>
            <ol className="ds-rows">{rows.slice(0, SHOWN).map(row)}</ol>
          </Panel>
          {rows.length > SHOWN && (
            <Fold label={`Show all ${rows.length}`}>
              <ol className="ds-rows st-flush">{rows.slice(SHOWN).map(row)}</ol>
            </Fold>
          )}
        </>
      )}
    </Section>
  );
}

function ByModel({ summary }: { summary: CostSummary }) {
  return (
    <Section title="Tokens by model" id="models" data-testid="tokens-by-model" className="ds-rise" style={rise(4)}>
      <Panel className="ad-table-panel">
        <table className="ad-table">
          <caption className="ds-sr">Tokens, calls and cost for each model this month</caption>
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
      </Panel>
    </Section>
  );
}

function TopLessons({ summary }: { summary: CostSummary }) {
  const rows = summary.top_lessons;
  const row = (l: (typeof rows)[number]) => {
    const ex = getExercise(l.exercise_id);
    const mod = ex && "module" in ex && ex.module in MODULE_INFO ? MODULE_INFO[ex.module as keyof typeof MODULE_INFO] : null;
    return (
      <RankRow
        key={l.exercise_id}
        testid="lesson-row"
        name={exerciseTitle(l.exercise_id)}
        sub={`${mod ? `Module ${mod.number}, ${mod.title}` : "Practice"} · ${l.students} students`}
        n={`${shortTokens(l.tokens)} tokens`}
        cost={usd(l.cost_usd)}
      />
    );
  };
  return (
    <Section title="Top lessons by usage" id="lessons" data-testid="top-lessons" className="ds-rise" style={rise(5)} desc="Tokens this month, coaching and model runs together.">
      {rows.length === 0 ? (
        <Panel>
          <p>No lesson task has used the coach this month.</p>
        </Panel>
      ) : (
        <>
          <Panel list>
            <ol className="ds-rows">{rows.slice(0, 3).map(row)}</ol>
          </Panel>
          {rows.length > 3 && (
            <Fold label={`Show all ${rows.length}`}>
              <ol className="ds-rows st-flush">{rows.slice(3).map(row)}</ol>
            </Fold>
          )}
        </>
      )}
    </Section>
  );
}
