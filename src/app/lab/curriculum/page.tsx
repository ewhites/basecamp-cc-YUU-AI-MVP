import { SampleTag } from "@/components/Tags";
import { SKILLS, SKILL_BLURBS, SKILL_LABELS, type Skill } from "@/lib/curriculum/types";
import { pct } from "@/lib/insights";
import { requireRole } from "@/lib/session";
import { CYCLE_STUDENTS, curriculumOverview, heatClass } from "@/lib/staff-data";
import { DraftList } from "./DraftList";
import { RubricEditor } from "./RubricEditor";

export const dynamic = "force-dynamic";
/** "Run eval on this draft" grades the held-out set in a server action, which can take a while. */
export const maxDuration = 300;

const skillName = (s: string) => SKILL_LABELS[s as Skill] ?? s;

export default async function CurriculumInsights() {
  await requireRole("curriculum");
  const d = await curriculumOverview();
  const weeks = [...new Set(d.trend.map((t) => t.week))].sort((a, b) => a - b);
  const trendAt = (week: number, skill: Skill) => d.trend.find((t) => t.week === week && t.skill === skill);

  // Group table rows by exercise so the title shows once.
  const groups: { exerciseId: string; title: string; rows: typeof d.rows }[] = [];
  for (const r of d.rows) {
    const g = groups.at(-1);
    if (g && g.exerciseId === r.exerciseId) g.rows.push(r);
    else groups.push({ exerciseId: r.exerciseId, title: r.exerciseTitle, rows: [r] });
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="row">
            <h1 style={{ margin: 0 }}>Curriculum insights</h1>
            <SampleTag />
          </div>
          <p className="muted" style={{ margin: "0.3rem 0 0" }}>
            Which rubric checks students pass and miss, by section. Names are hidden by design: this page only gets totals, never student rows.
          </p>
        </div>
      </div>

      {d.errors.length > 0 && <div className="notice notice-fail">Some data could not load: {d.errors.join(" · ")}</div>}

      {/* ---------------- hardest checks */}
      <section className="card" data-testid="hardest-checks">
        <h2>The five hardest checks</h2>
        <p className="small muted">Lowest pass rate across every exercise and section (at least 20 graded attempts each), with the 10-minute mini-lesson for each.</p>
        {d.hardest.length === 0 ? (
          <p className="muted">Not enough graded attempts yet.</p>
        ) : (
          <ol className="stack" style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {d.hardest.map((h) => (
              <li key={h.key}>
                <div className="row">
                  <strong>{h.text}</strong>
                  <span className={heatClass(h.rate)} style={{ padding: "0.1rem 0.5rem" }}>
                    {pct(h.rate)}
                  </span>
                  <span className="small muted">
                    {skillName(h.skill)} · n={h.n.toLocaleString("en-US")}
                  </span>
                </div>
                {h.miniLesson && (
                  <div className="tip small" style={{ marginTop: "0.35rem" }}>
                    <strong>Mini-lesson:</strong> {h.miniLesson}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ---------------- pass rate table */}
      <section className="card" data-testid="check-stats">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Pass rate by exercise and check</h2>
          <span className="row small">
            <span className="heat heat-0" style={{ padding: "0.1rem 0.4rem" }}>&lt;40%</span>
            <span className="heat heat-1" style={{ padding: "0.1rem 0.4rem" }}>40-54%</span>
            <span className="heat heat-2" style={{ padding: "0.1rem 0.4rem" }}>55-69%</span>
            <span className="heat heat-3" style={{ padding: "0.1rem 0.4rem" }}>70-84%</span>
            <span className="heat heat-4" style={{ padding: "0.1rem 0.4rem" }}>85%+</span>
          </span>
        </div>
        <div style={{ overflowX: "auto", marginTop: "0.6rem" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Exercise</th>
                <th>Check</th>
                <th>Skill</th>
                {d.sections.map((s) => (
                  <th key={s} style={{ textAlign: "center", width: 70 }}>
                    {s}
                  </th>
                ))}
                <th style={{ textAlign: "center", width: 80 }}>Overall</th>
                <th style={{ textAlign: "right", width: 60 }}>n</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) =>
                g.rows.map((r, i) => (
                  <tr key={`${r.exerciseId}:${r.key}`}>
                    {i === 0 && (
                      <td rowSpan={g.rows.length}>
                        <strong>{g.title}</strong>
                      </td>
                    )}
                    <td>{r.text}</td>
                    <td className="small muted">{skillName(r.skill)}</td>
                    {d.sections.map((s) => {
                      const c = r.bySection[s];
                      return (
                        <td key={s}>
                          <div className={heatClass(c ? c.rate : null)} title={c ? `${c.attempts} graded` : "No data"}>
                            {c ? pct(c.rate) : "–"}
                          </div>
                        </td>
                      );
                    })}
                    <td>
                      <div className={heatClass(r.overall)}>{pct(r.overall)}</div>
                    </td>
                    <td style={{ textAlign: "right" }} className="small">
                      {r.n.toLocaleString("en-US")}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------- program trend */}
      <section className="card" data-testid="program-trend">
        <div className="row">
          <h2 style={{ margin: 0 }}>Program trend by week</h2>
          <span className="tag tag-info">Scaled from sample</span>
        </div>
        <p className="small muted">Pass rate per skill, week 1 to 4 of the unit, scaled to a {CYCLE_STUDENTS.toLocaleString("en-US")}-student cycle. A dash means no exercise tested that skill that week.</p>
        {d.trend.length === 0 ? (
          <p className="muted">No program rollups yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Skill</th>
                {weeks.map((w) => (
                  <th key={w} style={{ textAlign: "center" }}>
                    Week {w}
                  </th>
                ))}
                <th style={{ textAlign: "right" }}>Change</th>
              </tr>
            </thead>
            <tbody>
              {SKILLS.map((s) => {
                const seen = weeks.map((w) => trendAt(w, s)).filter((t) => t !== undefined);
                const delta = seen.length >= 2 ? Math.round((seen.at(-1)!.pass_rate - seen[0]!.pass_rate) * 100) : null;
                return (
                  <tr key={s}>
                    <td>
                      <strong>{SKILL_LABELS[s]}</strong>
                      <div className="small muted">{SKILL_BLURBS[s]}</div>
                    </td>
                    {weeks.map((w) => {
                      const t = trendAt(w, s);
                      return (
                        <td key={w}>
                          <div className={heatClass(t ? t.pass_rate : null)}>{t ? pct(t.pass_rate) : "–"}</div>
                        </td>
                      );
                    })}
                    <td style={{ textAlign: "right" }} className={delta !== null && delta < 0 ? "" : "muted"}>
                      {delta === null ? "–" : `${delta > 0 ? "+" : ""}${delta} pts`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ---------------- rubric editor */}
      <div className="split">
        <section className="card" data-testid="rubric-editor">
          <h2>Rubric editor</h2>
          <p className="small muted">Reword a check. It saves as a draft, then has to pass the coach eval before you can publish it.</p>
          <RubricEditor exercises={d.editor} />
        </section>
        <section className="card" data-testid="rubric-drafts">
          <h2>Drafts</h2>
          <p className="small muted">Publish stays locked until an eval run on that draft passes the gate (80% held-out agreement). The database checks this too.</p>
          <DraftList
            drafts={d.drafts.map((x) => ({
              id: x.id,
              exerciseTitle: x.exerciseTitle,
              key: x.key,
              version: x.version,
              text: x.text,
              status: x.status,
              createdAt: x.created_at,
              publishedText: x.publishedText,
              latestEval: x.latestEval ? { passedGate: x.latestEval.passed_gate, summary: x.latestEval.summary, createdAt: x.latestEval.created_at } : null,
              canPublish: x.canPublish,
            }))}
          />
        </section>
      </div>
    </div>
  );
}
