import Link from "next/link";
import { CheckList, type CheckLike } from "@/components/CheckList";
import { SampleTag, StatusTag } from "@/components/Tags";
import { getExercise } from "@/lib/curriculum/exercises";
import { SKILL_LABELS, SKILLS, type Skill } from "@/lib/curriculum/types";
import { pct } from "@/lib/insights";
import {
  attemptReplay,
  exerciseTitle,
  firstAndNow,
  heatClass,
  mySections,
  needsReviewAttempts,
  openSafetyFlags,
  sectionOverview,
  studentAttempts,
  type AttemptReplay,
  type StudentRow,
} from "@/lib/instructor-data";
import { requireRole } from "@/lib/session";
import { AssignMiniLesson, OverrideForm, SendToGradebook } from "./ConsoleButtons";

type Params = { section?: string; student?: string; attempt?: string };

function href(p: Params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) q.set(k, v);
  return `/lab/instructor?${q.toString()}`;
}

function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const FLAG_LABELS: Record<string, string> = {
  distress: "Support needed",
  pii_removed: "Personal details removed",
  prompt_injection: "Tried to game the coach",
  refusal: "AI refused",
};

export default async function InstructorConsole({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRole("instructor");
  const params = await searchParams;
  const sections = await mySections();
  const sectionId = params.section ?? (sections.some((s) => s.id === "B") ? "B" : sections[0]?.id);
  const section = sections.find((s) => s.id === sectionId);

  const head = (
    <div className="page-head">
      <div>
        <div className="row">
          <h1 style={{ margin: 0 }}>Instructor console</h1>
          <SampleTag />
        </div>
        <p className="muted" style={{ margin: "0.3rem 0 0" }}>
          See who understands what, check the coach&apos;s scores, and release them when you agree.
        </p>
      </div>
      {section && <SendToGradebook sectionId={section.id} />}
    </div>
  );

  const tabs = (
    <nav className="row" aria-label="Your sections" data-testid="section-tabs">
      {sections.map((s) => (
        <Link key={s.id} href={href({ section: s.id })} className={`btn ${s.id === sectionId ? "btn-primary" : ""}`} aria-current={s.id === sectionId ? "page" : undefined}>
          {s.name}
        </Link>
      ))}
    </nav>
  );

  if (!section) {
    return (
      <div className="stack">
        {head}
        {tabs}
        <div className="notice notice-warn" data-testid="no-access">
          {sections.length ? "You don't teach that section, so there is nothing to show." : "You have no sections yet."}
        </div>
      </div>
    );
  }

  const overview = await sectionOverview(section.id);
  const ids = overview.students.map((s) => s.id);
  const [safety, review] = await Promise.all([openSafetyFlags(ids), needsReviewAttempts(ids)]);
  const byId = new Map(overview.students.map((s) => [s.id, s]));
  const name = (id: string) => byId.get(id)?.display_name ?? id;
  const selected = params.student ? byId.get(params.student) : undefined;

  const stuckBySkill = new Map<Skill, string[]>();
  for (const f of overview.flags) stuckBySkill.set(f.skill, [...(stuckBySkill.get(f.skill) ?? []), f.student_id]);

  return (
    <div className="stack">
      {head}
      {tabs}

      {params.student && !selected && <div className="notice notice-warn">That student is not in {section.name}.</div>}
      {selected && <StudentDetail sectionId={section.id} student={selected} attemptId={params.attempt} />}

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)", alignItems: "start" }}>
        <section className="card" data-testid="heatmap">
          <div className="row between">
            <h2 style={{ margin: 0 }}>
              {section.name} skills <span className="small muted">({overview.students.length} students)</span>
            </h2>
            <span className="small muted">Pass rate on each skill, last 3 attempts</span>
          </div>
          <div style={{ overflowX: "auto", marginTop: "0.6rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  {SKILLS.map((s) => (
                    <th key={s} style={{ textAlign: "center" }}>
                      {SKILL_LABELS[s]}
                    </th>
                  ))}
                  <th style={{ textAlign: "center" }}>First → now</th>
                </tr>
              </thead>
              <tbody>
                {overview.students.map((st) => {
                  const lv = overview.levels.get(st.id);
                  const fn = firstAndNow(lv);
                  return (
                    <tr key={st.id} data-testid={`heat-row-${st.id}`}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <Link href={href({ section: section.id, student: st.id })}>{st.display_name}</Link>
                        <div className="small muted">{st.id}</div>
                      </td>
                      {SKILLS.map((s) => {
                        const c = lv?.[s].current ?? null;
                        return (
                          <td key={s}>
                            <div className={`heat ${heatClass(c)}`} title={`${SKILL_LABELS[s]}: ${pct(c)}`}>
                              {pct(c)}
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                        {pct(fn.first)} → <b>{pct(fn.now)}</b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="row small muted" style={{ marginTop: "0.6rem" }}>
            Key:
            <span className="heat heat-0" style={{ padding: "0 0.4rem" }}>under 40%</span>
            <span className="heat heat-2" style={{ padding: "0 0.4rem" }}>55–69%</span>
            <span className="heat heat-4" style={{ padding: "0 0.4rem" }}>85%+</span>
          </div>
        </section>

        <div className="stack">
          <section className="card" data-testid="stuck-panel">
            <h2>Flagged: stuck</h2>
            {stuckBySkill.size === 0 ? (
              <p className="small muted">Nobody is stuck right now.</p>
            ) : (
              <div className="stack">
                {[...stuckBySkill.entries()]
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([skill, students]) => (
                    <div key={skill} data-testid={`stuck-${skill}`}>
                      <b>
                        {students.length} {students.length === 1 ? "student" : "students"} stuck on {SKILL_LABELS[skill]}
                      </b>
                      <ul className="small" style={{ margin: "0.3rem 0 0", paddingLeft: "1.1rem" }}>
                        {students.map((id) => (
                          <li key={id}>
                            <Link href={href({ section: section.id, student: id })}>{name(id)}</Link> <span className="muted">{id}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                <p className="small muted" style={{ margin: 0 }}>
                  Stuck means under 40% on a skill across their last 3 attempts that test it.
                </p>
              </div>
            )}
          </section>

          {overview.miniLesson && (
            <section className="card" data-testid="mini-lesson">
              <h2>Suggested 10-minute mini-lesson</h2>
              <p className="small muted">
                For the {overview.miniLesson.students} {overview.miniLesson.students === 1 ? "student" : "students"} stuck on {SKILL_LABELS[overview.miniLesson.skill]}. The
                check they miss most: <b>{overview.miniLesson.check.text}</b> (passed {pct(overview.miniLesson.check.rate)} of {overview.miniLesson.check.n} times).
              </p>
              <div className="tip">{overview.miniLesson.check.miniLesson}</div>
              <div style={{ marginTop: "0.75rem" }}>
                <AssignMiniLesson title={overview.miniLesson.check.text} />
              </div>
            </section>
          )}

          <section className="card" data-testid="safety-flags">
            <h2>Open safety flags</h2>
            {safety.length === 0 ? (
              <p className="small muted">None open.</p>
            ) : (
              <table className="table">
                <tbody>
                  {safety.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <span className={`tag ${f.kind === "distress" ? "tag-fail" : "tag-warn"}`}>{FLAG_LABELS[f.kind] ?? f.kind}</span>
                      </td>
                      <td>
                        <Link href={href({ section: section.id, student: f.student_id })}>{name(f.student_id)}</Link>
                        <div className="small">{f.detail}</div>
                      </td>
                      <td className="small muted">{when(f.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card" data-testid="needs-review">
            <h2>Needs your review</h2>
            {review.length === 0 ? (
              <p className="small muted">Nothing waiting.</p>
            ) : (
              <>
                <p className="small muted">The coach could not confirm a quote on these. Check them before you send scores.</p>
                <table className="table">
                  <tbody>
                    {review.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <Link href={href({ section: section.id, student: a.student_id, attempt: a.id })}>{name(a.student_id)}</Link>
                          <div className="small muted">
                            {exerciseTitle(a.exercise_id)}, attempt {a.attempt_no}
                          </div>
                        </td>
                        <td className="small muted">{when(a.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

async function StudentDetail({ sectionId, student, attemptId }: { sectionId: string; student: StudentRow; attemptId?: string }) {
  const attempts = await studentAttempts(student.id);
  const replay = attemptId ? await attemptReplay(attemptId) : null;
  const ok = replay && replay.student_id === student.id ? replay : null;
  return (
    <section className="card" data-testid="student-detail">
      <div className="row between">
        <div>
          <h2 style={{ margin: 0 }}>{student.display_name}</h2>
          <div className="small muted">
            {student.id} · {student.track}
          </div>
        </div>
        <Link href={href({ section: sectionId })} className="btn btn-subtle">
          Close
        </Link>
      </div>
      <div className="split" style={{ marginTop: "0.75rem" }}>
        <div style={{ maxHeight: "640px", overflowY: "auto" }}>
          <table className="table" data-testid="attempt-list">
            <thead>
              <tr>
                <th>Exercise</th>
                <th>Score</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} style={a.id === attemptId ? { background: "var(--d2l-color-celestine-plus-2)" } : undefined}>
                  <td>
                    <Link href={href({ section: sectionId, student: student.id, attempt: a.id })}>{exerciseTitle(a.exercise_id)}</Link>
                    <div className="small muted">Attempt {a.attempt_no}</div>
                  </td>
                  <td>{a.passed !== null ? `${a.passed}/${a.total}` : "–"}</td>
                  <td>
                    <StatusTag status={a.status} />
                    {a.released_at && <div className="small muted">Sent</div>}
                  </td>
                  <td className="small muted">{when(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {attempts.length === 0 && <p className="small muted">No attempts yet.</p>}
        </div>
        <div>
          {attemptId && !ok && <div className="notice notice-warn">That attempt is not available.</div>}
          {ok ? <Replay attempt={ok} /> : !attemptId && <p className="small muted">Pick an attempt to replay it.</p>}
        </div>
      </div>
    </section>
  );
}

function str(x: unknown): string {
  return typeof x === "string" ? x : "";
}

function Replay({ attempt }: { attempt: AttemptReplay }) {
  const ex = getExercise(attempt.exercise_id);
  const input = attempt.input ?? {};
  const output = attempt.output ?? {};
  const outputs = Array.isArray(output.outputs) && output.outputs.length ? (output.outputs as { model: string; text: string; latencyMs?: number; costUsd?: number }[]) : null;
  const transcript = Array.isArray(output.transcript) && output.transcript.length ? (output.transcript as { id: string; from: string; text: string; reply: string }[]) : null;
  const checks: CheckLike[] = attempt.check_results.map((c) => ({
    key: c.check_key,
    skill: c.skill,
    pass: c.pass,
    evidence: c.evidence,
    reason: c.reason,
    needsReview: c.needs_review,
    overridden: c.overridden,
    overrideNote: c.override_note,
    method: c.coach_pass === null ? "code" : "coach",
  }));
  const order = (k: string) => ex?.checks.findIndex((c) => c.key === k) ?? 0;
  const label = (k: string) => ex?.checks.find((c) => c.key === k)?.text ?? k;

  return (
    <div className="stack" data-testid="attempt-replay">
      <div className="row between">
        <div className="row">
          <h3 style={{ margin: 0 }}>
            {exerciseTitle(attempt.exercise_id)}, attempt {attempt.attempt_no}
          </h3>
          <StatusTag status={attempt.status} />
        </div>
        {attempt.passed !== null && (
          <span className="stat" data-testid="replay-score">
            {attempt.passed}/{attempt.total}
            <span className="stat-label"> checks passed</span>
          </span>
        )}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Your view of this attempt is logged.
      </p>

      <div>
        <h3>What the student wrote</h3>
        {str(input.instructions) && <pre data-testid="replay-input">{str(input.instructions)}</pre>}
        {str(input.prompt) && <pre data-testid="replay-input">{str(input.prompt)}</pre>}
        {str(input.pickedModel) && (
          <div className="small" style={{ marginTop: "0.4rem" }}>
            Picked: <b>{str(input.pickedModel)}</b>
          </div>
        )}
        {str(input.reasoning) && <pre style={{ marginTop: "0.4rem" }}>{str(input.reasoning)}</pre>}
      </div>

      <div>
        <h3>What the AI produced</h3>
        {str(output.text) && <pre data-testid="replay-output">{str(output.text)}</pre>}
        {outputs && (
          <div className="stack" data-testid="replay-output">
            {outputs.map((o) => (
              <div key={o.model}>
                <div className="small">
                  <b>{o.model}</b>
                  {o.latencyMs !== undefined && <span className="muted"> · {(o.latencyMs / 1000).toFixed(1)}s</span>}
                  {o.costUsd !== undefined && <span className="muted"> · ${o.costUsd.toFixed(4)}</span>}
                  {o.model === str(input.pickedModel) && <span className="tag tag-info" style={{ marginLeft: "0.4rem" }}>Picked</span>}
                </div>
                <pre>{o.text}</pre>
              </div>
            ))}
          </div>
        )}
        {transcript && (
          <div className="stack" data-testid="replay-output">
            {transcript.map((t) => (
              <div key={t.id} className="small">
                <div>
                  <b>{t.from}:</b> {t.text}
                </div>
                <pre style={{ marginTop: "0.2rem" }}>{t.reply}</pre>
              </div>
            ))}
          </div>
        )}
        {!str(output.text) && !outputs && !transcript && <p className="small muted">No output saved.</p>}
      </div>

      {attempt.tip && (
        <div className="tip" data-testid="coach-tip">
          <b>Coach tip:</b> {attempt.tip}
        </div>
      )}

      {checks.length > 0 && (
        <>
          <h3 style={{ marginBottom: 0 }}>Coach&apos;s draft scores</h3>
          <CheckList exerciseId={attempt.exercise_id} checks={checks} staff />
          <details data-testid="override-panel">
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Change a score</summary>
            <div className="stack" style={{ marginTop: "0.6rem" }}>
              {[...attempt.check_results]
                .sort((a, b) => order(a.check_key) - order(b.check_key))
                .map((c) => (
                  <OverrideForm key={`${attempt.id}-${c.check_key}`} attemptId={attempt.id} checkKey={c.check_key} label={label(c.check_key)} pass={c.pass} />
                ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
