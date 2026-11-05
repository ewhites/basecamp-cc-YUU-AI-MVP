import Link from "next/link";
import { CheckList, type CheckLike } from "@/components/CheckList";
import { SampleTag, StatusTag } from "@/components/Tags";
import { getExercise } from "@/lib/curriculum/exercises";
import { SKILL_LABELS, SKILLS } from "@/lib/curriculum/types";
import { practiceOnly, skillLevels } from "@/lib/insights";
import {
  attemptReplay,
  checkRowsFor,
  exerciseTitle,
  heatClass,
  studentAttempts,
  studentById,
  type AttemptReplay,
} from "@/lib/instructor-data";
import { scoreChecks } from "@/lib/progress";
import { requireRole } from "@/lib/session";
import { OverrideForm } from "../../ConsoleButtons";
import { percent, sectionHref, shortDate, studentHref } from "../../links";

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ attempt?: string }> }) {
  await requireRole("instructor");
  const { id } = await params;
  const { attempt: attemptId } = await searchParams;
  const student = await studentById(decodeURIComponent(id));

  if (!student) {
    return (
      <div className="stack">
        <Link href="/lab/instructor" className="btn btn-subtle ic-back">
          Back to your sections
        </Link>
        <div className="notice notice-warn" data-testid="no-access">
          That student is not in your sections.
        </div>
      </div>
    );
  }

  const [attempts, rows, replay] = await Promise.all([
    studentAttempts(student.id),
    checkRowsFor([student.id]),
    attemptId ? attemptReplay(attemptId) : Promise.resolve(null),
  ]);
  const levels = skillLevels(practiceOnly(rows)).get(student.id);
  const checkRows = rows.map((r) => ({ exercise_id: r.exercise_id ?? "", skill: r.skill, pass: r.pass }));
  const start = scoreChecks(checkRows, "start");
  const final = scoreChecks(checkRows, "final");
  const ok = replay && replay.student_id === student.id ? replay : null;

  return (
    <div className="ic" data-testid="student-detail">
      <Link href={sectionHref(student.section_id)} className="btn btn-subtle ic-back">
        Back to Section {student.section_id}
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            {student.id} &middot; {student.track}
          </div>
          <h1>{student.display_name}</h1>
          <SampleTag />
        </div>
      </div>

      <section className="card card-tight" data-testid="student-skills">
        <div className="ic-skills">
          {SKILLS.map((s) => {
            const c = levels?.[s].current ?? null;
            const a = start[s];
            const b = final[s];
            return (
              <div key={s} className="ic-skill">
                <div className="small">
                  <b>{SKILL_LABELS[s]}</b>
                </div>
                <div className={`heat ${heatClass(c)} ic-skill-heat`} title="Practice pass rate, last 3 attempts">
                  {percent(c)}
                </div>
                <div className="tiny muted ic-num">
                  {a === null ? "No starting point yet" : b === null ? `Starting point ${percent(a)}` : `Checks: ${percent(a)} to ${percent(b)}`}
                </div>
              </div>
            );
          })}
        </div>
        <p className="tiny muted" style={{ margin: "10px 0 0" }}>
          Colored number: practice pass rate over the last 3 attempts on that skill. Checks: starting point score to final check score.
        </p>
      </section>

      <div className="split ic-split">
        <section className="card card-tight">
          <h3>Attempts</h3>
          {attempts.length === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>
              No attempts yet.
            </p>
          ) : (
            <div className="ic-attempts">
              <table className="table" data-testid="attempt-list">
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className={a.id === attemptId ? "is-selected" : undefined}>
                      <td>
                        <Link href={studentHref(student.id, a.id)} aria-current={a.id === attemptId ? "true" : undefined}>
                          {exerciseTitle(a.exercise_id)}
                        </Link>
                        <div className="tiny muted">
                          Attempt {a.attempt_no} &middot; {shortDate(a.created_at)}
                          {a.released_at && " · Sent"}
                        </div>
                      </td>
                      <td className="ic-right ic-nowrap">
                        <div className="ic-num">{a.passed !== null ? `${a.passed}/${a.total}` : "–"}</div>
                        {a.status !== "scored" && <StatusTag status={a.status} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          {attemptId && !ok && <div className="notice notice-warn">That attempt is not available.</div>}
          {ok ? (
            <Replay attempt={ok} />
          ) : (
            !attemptId && (
              <p className="muted" style={{ margin: 0 }}>
                Pick an attempt to see what {student.display_name.split(" ")[0]} wrote, what the AI produced and the coach&apos;s draft scores.
              </p>
            )
          )}
        </section>
      </div>
    </div>
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
  const written = [str(input.instructions), str(input.prompt), str(input.answer)].filter(Boolean);
  const isCheck = attempt.studio === "check";
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
  const review = attempt.check_results.some((c) => c.needs_review);

  return (
    <div className="stack" data-testid="attempt-replay">
      <div className="row between">
        <div>
          <div className="eyebrow">
            Attempt {attempt.attempt_no} &middot; {shortDate(attempt.created_at)}
          </div>
          <h2 style={{ margin: 0 }}>{exerciseTitle(attempt.exercise_id)}</h2>
        </div>
        {attempt.passed !== null && (
          <div className="ic-right">
            <span className="stat" data-testid="replay-score">
              {attempt.passed}/{attempt.total}
            </span>
            <div className="stat-label">checks passed</div>
          </div>
        )}
      </div>
      <div className="row">
        <StatusTag status={attempt.status} />
        {attempt.released_at ? <span className="tag tag-quiet">Sent to gradebook</span> : <span className="tag tag-quiet">Not sent yet</span>}
        <span className="tiny muted">Your view of this attempt is logged.</span>
      </div>

      <div>
        <h3>What the student wrote</h3>
        {written.map((t, i) => (
          <pre key={i} data-testid="replay-input">
            {t}
          </pre>
        ))}
        {str(input.pickedModel) && (
          <div className="small ic-gap">
            Picked: <b>{str(input.pickedModel)}</b>
          </div>
        )}
        {str(input.reasoning) && <pre className="ic-gap">{str(input.reasoning)}</pre>}
        {!written.length && !str(input.reasoning) && <p className="small muted">{attempt.status === "distress" ? "Not stored. Support messages are never saved." : "Nothing saved."}</p>}
      </div>

      {!isCheck && (
        <div>
          <h3>What the AI produced</h3>
          {str(output.text) && <pre data-testid="replay-output">{str(output.text)}</pre>}
          {outputs && (
            <div className="stack-sm" data-testid="replay-output">
              {outputs.map((o) => (
                <div key={o.model}>
                  <div className="small">
                    <b>{o.model}</b>
                    {o.latencyMs !== undefined && <span className="muted"> &middot; {(o.latencyMs / 1000).toFixed(1)}s</span>}
                    {o.costUsd !== undefined && <span className="muted"> &middot; ${o.costUsd.toFixed(4)}</span>}
                    {o.model === str(input.pickedModel) && <span className="tag tag-info ic-gap-l">Picked</span>}
                  </div>
                  <pre>{o.text}</pre>
                </div>
              ))}
            </div>
          )}
          {transcript && (
            <div className="stack-sm" data-testid="replay-output">
              {transcript.map((t) => (
                <div key={t.id} className="small">
                  <div>
                    <b>{t.from}:</b> {t.text}
                  </div>
                  <pre className="ic-gap">{t.reply}</pre>
                </div>
              ))}
            </div>
          )}
          {!str(output.text) && !outputs && !transcript && <p className="small muted">No output saved.</p>}
        </div>
      )}

      {attempt.tip && (
        <div className="tip" data-testid="coach-tip">
          <b>Coach tip:</b> {attempt.tip}
        </div>
      )}

      {checks.length > 0 && (
        <div>
          <h3>Coach&apos;s draft scores</h3>
          {review && <div className="notice notice-warn small ic-gap-b">The coach could not confirm a quote on at least one check. Check it and save your call below.</div>}
          <CheckList exerciseId={attempt.exercise_id} checks={checks} staff />
          <details className="ic-override" data-testid="override-panel" open={review}>
            <summary>Change a score</summary>
            <p className="tiny muted">Your note is saved with the change and recorded in the audit log.</p>
            <div className="stack">
              {[...attempt.check_results]
                .sort((a, b) => order(a.check_key) - order(b.check_key))
                .map((c) => (
                  <OverrideForm key={`${attempt.id}-${c.check_key}`} attemptId={attempt.id} checkKey={c.check_key} label={label(c.check_key)} pass={c.pass} />
                ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
