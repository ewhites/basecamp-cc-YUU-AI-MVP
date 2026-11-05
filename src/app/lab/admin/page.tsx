import { SampleTag } from "@/components/Tags";
import { EXERCISES } from "@/lib/curriculum/exercises";
import { pct } from "@/lib/insights";
import { modelLabel } from "@/lib/models";
import { requireRole } from "@/lib/session";
import { CYCLE_STUDENTS, SAMPLE_STUDENTS, adminOverview, asRate, gateVerdict, num, usd, type EvalRun } from "@/lib/staff-data";
import { BreakGlass } from "./BreakGlass";

export const dynamic = "force-dynamic";

const PURPOSE_LABELS: Record<string, string> = {
  grade: "Coach grading",
  run_prompt: "Prompt Studio runs",
  arena: "Model Arena runs",
  bot: "Agent Builder bots",
  qa: "Lesson Q&A",
  eval: "Evals",
};

const FLAG_LABELS: Record<string, string> = {
  distress: "Distress",
  pii_removed: "Personal data removed",
  prompt_injection: "Prompt injection",
  refusal: "Refusal",
};

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function EvalCard({ title, run }: { title: string; run: EvalRun | null }) {
  if (!run) {
    return (
      <div className="card card-muted" data-testid={`eval-${title.toLowerCase()}`}>
        <h3>{title}</h3>
        <p className="muted" style={{ margin: 0 }}>
          No eval run yet. Run <code>npm run eval</code>.
        </p>
      </div>
    );
  }
  const s = run.summary ?? {};
  const verdict = gateVerdict(run);
  const rates: [string, unknown][] = [
    ["Agreement (all cases)", s.agreement],
    ["Held-out agreement", s.heldOutAgreement],
    ["Consistency across reruns", s.consistency],
  ];
  const byGroup = s.byGroup && typeof s.byGroup === "object" ? Object.entries(s.byGroup as Record<string, unknown>) : [];
  return (
    <div className="card card-muted" data-testid={`eval-${title.toLowerCase()}`}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className={`tag ${verdict.pass ? "tag-pass" : "tag-fail"}`}>{verdict.pass ? "Pass" : "Fail"}</span>
      </div>
      <p className="small muted">{verdict.basis}</p>
      <table className="table">
        <tbody>
          {rates
            .filter(([, v]) => asRate(v) !== null)
            .map(([label, v]) => (
              <tr key={label}>
                <td>{label}</td>
                <td style={{ textAlign: "right" }}>{pct(asRate(v))}</td>
              </tr>
            ))}
          {s.safetyTotal !== undefined && (
            <tr>
              <td>Safety cases handled</td>
              <td style={{ textAlign: "right" }}>
                {String(s.safetyPassed ?? "–")}/{String(s.safetyTotal)}
              </td>
            </tr>
          )}
          {byGroup.map(([g, v]) => (
            <tr key={g}>
              <td>Agreement, {g}</td>
              <td style={{ textAlign: "right" }}>{asRate(v) !== null ? pct(asRate(v)) : JSON.stringify(v)}</td>
            </tr>
          ))}
          <tr>
            <td>Model</td>
            <td style={{ textAlign: "right" }}>{modelLabel(String(s.model ?? run.model))}</td>
          </tr>
          <tr>
            <td>Prompt version</td>
            <td style={{ textAlign: "right" }}>
              <code>{String(s.prompt_version ?? run.prompt_version)}</code>
            </td>
          </tr>
          <tr>
            <td>Stored gate result</td>
            <td style={{ textAlign: "right" }}>{run.passed_gate ? "Passed" : "Not passed"}</td>
          </tr>
          <tr>
            <td>Run at</td>
            <td style={{ textAlign: "right" }}>{when(run.created_at)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminCenter() {
  await requireRole("admin");
  const d = await adminOverview();
  const usedShare = d.budget.monthlyCapUsd > 0 ? d.month.spend / d.budget.monthlyCapUsd : 0;
  const barClass = usedShare >= 1 ? "var(--fail)" : usedShare >= 0.8 ? "var(--warn)" : "var(--primary)";
  const monthName = new Date(d.month.since).toLocaleString("en-US", { month: "long" });
  const titles = Object.fromEntries(EXERCISES.map((e) => [e.id, e.title]));
  const cohortTotals = d.cohorts.reduce((t, c) => ({ calls: t.calls + c.calls, tokens: t.tokens + c.tokens, cost: t.cost + c.cost_usd }), { calls: 0, tokens: 0, cost: 0 });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="row">
            <h1 style={{ margin: 0 }}>Admin and security center</h1>
            <SampleTag />
          </div>
          <p className="muted" style={{ margin: "0.3rem 0 0" }}>
            Spend, safety flags, the audit trail and how the coach scores on its evals.
          </p>
        </div>
      </div>

      {d.errors.length > 0 && (
        <div className="notice notice-fail">
          Some data could not load: {d.errors.join(" · ")}
        </div>
      )}

      {/* ---------------- usage and spend */}
      <section className="card" data-testid="admin-usage">
        <h2>Usage and spend</h2>
        <div className="grid grid-4">
          <div>
            <div className="stat" data-testid="mtd-spend">{usd(d.month.spend)}</div>
            <div className="stat-label">Spent in {monthName} so far</div>
          </div>
          <div>
            <div className="stat">{usd(d.budget.monthlyCapUsd)}</div>
            <div className="stat-label">Monthly spend cap</div>
          </div>
          <div>
            <div className="stat">{num(d.month.calls)}</div>
            <div className="stat-label">Claude calls this month</div>
          </div>
          <div>
            <div className="stat">{num(d.month.tokens)}</div>
            <div className="stat-label">Tokens this month</div>
          </div>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <div className="row between small">
            <span>
              <strong>{usedShare > 0 && usedShare < 0.01 ? "Under 1%" : pct(usedShare)}</strong> of the monthly cap used
            </span>
            <span className="muted">New coaching pauses at 100%. A warning shows at 80%.</span>
          </div>
          <div className="bar" style={{ marginTop: "0.3rem", height: 12 }} role="img" aria-label={`${pct(usedShare)} of the monthly cap used`}>
            <span style={{ width: `${Math.min(100, usedShare * 100)}%`, background: barClass }} />
          </div>
        </div>
        <div className="grid grid-3" style={{ marginTop: "1rem" }}>
          <div className="card card-muted">
            <div className="stat">{num(d.budget.dailyTokensPerStudent)}</div>
            <div className="stat-label">Daily token budget per student</div>
          </div>
          <div className="card card-muted">
            <div className="stat" data-testid="cost-per-student">{usd(d.allTime.perStudent)}</div>
            <div className="stat-label">
              Cost per student so far ({usd(d.allTime.studentSpend)} of student use / {SAMPLE_STUDENTS} sample students)
            </div>
          </div>
          <div className="card card-muted">
            <div className="stat" data-testid="cycle-projection">≈ {usd(d.allTime.projectedCycle)}</div>
            <div className="stat-label">
              At {CYCLE_STUDENTS.toLocaleString("en-US")} students per cycle. <span className="tag tag-info">Estimate, scaled from sample</span>
            </div>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: "0.6rem" }}>
          Costs are estimates from list prices. Staff and eval use so far: {usd(d.allTime.staffSpend)} (not counted per student).
        </p>

        <div className="grid grid-2" style={{ marginTop: "0.5rem" }}>
          <div>
            <h3>By cohort, {monthName} so far</h3>
            {d.cohorts.length === 0 ? (
              <p className="muted">No usage this month yet.</p>
            ) : (
              <table className="table" data-testid="cohort-table">
                <thead>
                  <tr>
                    <th>Cohort</th>
                    <th>Use</th>
                    <th style={{ textAlign: "right" }}>Calls</th>
                    <th style={{ textAlign: "right" }}>Tokens</th>
                    <th style={{ textAlign: "right" }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {d.cohorts.map((c) => (
                    <tr key={`${c.section_id}-${c.purpose}`}>
                      <td>{c.section_id === "staff/eval" ? "Staff and evals" : `Section ${c.section_id}`}</td>
                      <td>{PURPOSE_LABELS[c.purpose] ?? c.purpose}</td>
                      <td style={{ textAlign: "right" }}>{num(c.calls)}</td>
                      <td style={{ textAlign: "right" }}>{num(c.tokens)}</td>
                      <td style={{ textAlign: "right" }}>{usd(c.cost_usd)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2}>
                      <strong>Total</strong>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <strong>{num(cohortTotals.calls)}</strong>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <strong>{num(cohortTotals.tokens)}</strong>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <strong>{usd(cohortTotals.cost)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          <div>
            <h3>By model, {monthName} so far</h3>
            {d.month.byModel.length === 0 ? (
              <p className="muted">No usage this month yet.</p>
            ) : (
              <table className="table" data-testid="model-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th style={{ textAlign: "right" }}>Calls</th>
                    <th style={{ textAlign: "right" }}>Tokens</th>
                    <th style={{ textAlign: "right" }}>Cost</th>
                    <th style={{ width: "25%" }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {d.month.byModel.map((m) => {
                    const share = d.month.spend ? m.cost / d.month.spend : 0;
                    return (
                      <tr key={m.model}>
                        <td>{modelLabel(m.model)}</td>
                        <td style={{ textAlign: "right" }}>{num(m.calls)}</td>
                        <td style={{ textAlign: "right" }}>{num(m.tokens)}</td>
                        <td style={{ textAlign: "right" }}>{usd(m.cost)}</td>
                        <td>
                          <div className="bar" title={pct(share)}>
                            <span style={{ width: `${share * 100}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- evals */}
      <section className="card" data-testid="admin-evals">
        <h2>Latest eval results</h2>
        <p className="small muted">
          The gate: at least 80% agreement with human labels on the held-out set, and 20 out of 20 on the safety set.
        </p>
        <div className="grid grid-2">
          <EvalCard title="Grading" run={d.evals.grading} />
          <EvalCard title="Safety" run={d.evals.safety} />
        </div>
      </section>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        {/* ---------------- users */}
        <section className="card" data-testid="admin-users">
          <h2>Users and roles</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Persona</th>
              </tr>
            </thead>
            <tbody>
              {d.profiles.map((p) => (
                <tr key={p.id}>
                  <td>{p.display_name}</td>
                  <td style={{ textTransform: "capitalize" }}>{p.role}</td>
                  <td>
                    <code>{p.persona}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: "0.5rem" }}>
            Staff accounts only. Students sign in through Brightspace and are shown by pseudonymous ID.
          </p>
        </section>

        {/* ---------------- safety flags */}
        <section className="card" data-testid="admin-flags">
          <h2>Safety flags</h2>
          {d.flags.length === 0 ? (
            <p className="muted">No safety flags.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Student</th>
                  <th>Detail</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {d.flags.map((f) => (
                  <tr key={f.id}>
                    <td>{FLAG_LABELS[f.kind] ?? f.kind}</td>
                    <td>
                      <code>{f.student_id ?? "–"}</code>
                    </td>
                    <td className="small">{f.detail}</td>
                    <td>
                      <span className={`tag ${f.status === "open" ? "tag-warn" : "tag-pass"}`}>{f.status}</span>
                    </td>
                    <td className="small muted">{when(f.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="small muted" style={{ marginTop: "0.5rem" }}>
            Flags never store the student&apos;s own message.
          </p>
        </section>
      </div>

      {/* ---------------- break-glass */}
      <section className="card" data-testid="admin-breakglass">
        <h2>Break-glass: view one student&apos;s work</h2>
        <p className="small muted">For safety or support follow-ups only. You need a reason, and the view is logged.</p>
        <BreakGlass titles={titles} />
      </section>

      {/* ---------------- audit log */}
      <section className="card" data-testid="admin-audit">
        <h2>Audit log</h2>
        <p className="small muted">The latest 50 staff actions.</p>
        {d.audit.length === 0 ? (
          <p className="muted">Nothing logged yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Who</th>
                <th>Action</th>
                <th>Target</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {d.audit.map((a) => (
                <tr key={a.id}>
                  <td className="small muted" style={{ whiteSpace: "nowrap" }}>
                    {when(a.created_at)}
                  </td>
                  <td>
                    {a.actor}
                    {a.actor_role && <div className="small muted">{a.actor_role}</div>}
                  </td>
                  <td>
                    <code>{a.action}</code>
                  </td>
                  <td className="small">
                    <code>{a.target ?? "–"}</code>
                  </td>
                  <td className="small">{a.reason ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
