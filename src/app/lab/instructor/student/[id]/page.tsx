import Link from "next/link";
import { CheckList, type CheckLike } from "@/components/CheckList";
import { SampleTag, StatusTag } from "@/components/Tags";
import { getExercise } from "@/lib/curriculum/exercises";
import { SKILL_LABELS, SKILLS } from "@/lib/curriculum/types";
import { practiceOnly, skillLevels } from "@/lib/insights";
import {
  attemptReplay,
  checkRowsFor,
  dayText,
  exerciseTitle,
  heatClass,
  sectionOverview,
  studentAttempts,
  studentById,
  studentFlags,
  studentReasons,
  whenText,
  type AttemptReplay,
  type SafetyFlagRow,
  type StudentReason,
} from "@/lib/instructor-data";
import { scoreChecks } from "@/lib/progress";
import { requireRole } from "@/lib/session";
import { OverrideForm, ResolveFlagForm } from "../../ConsoleButtons";
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

  const [attempts, rows, replay, flags, overview] = await Promise.all([
    studentAttempts(student.id),
    checkRowsFor([student.id]),
    attemptId ? attemptReplay(attemptId) : Promise.resolve(null),
    studentFlags(student.id),
    sectionOverview(student.section_id),
  ]);
  const reasons = studentReasons(student, rows, attempts, flags, overview.stuck);
  const handled = flags.filter((f) => f.status === "resolved");
  const stuckSkills = new Set(reasons.flatMap((r) => (r.stuck ? [r.stuck.skill] : [])));
  const flaggedAttempts = new Set(reasons.flatMap((r) => (r.attempt_id ? [r.attempt_id] : [])));
  const first = student.display_name.split(" ")[0]!;
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

      <WhyCard first={first} reasons={reasons} handled={handled} studentId={student.id} />

      <section className="card card-tight" data-testid="student-skills">
        <div className="row between ic-card-head">
          <h3 style={{ margin: 0 }}>Skills</h3>
          <span className="tiny muted">Share of checks passed on the last 3 practice tries</span>
        </div>
        <div className="ic-skills">
          {SKILLS.map((s) => {
            const c = levels?.[s].current ?? null;
            const a = start[s];
            const b = final[s];
            const stuck = stuckSkills.has(s);
            return (
              <div key={s} className={`ic-skill${stuck ? " is-stuck" : ""}`} data-testid={stuck ? "stuck-skill" : undefined}>
                <div className="row between small">
                  <b>{SKILL_LABELS[s]}</b>
                  {stuck && <span className="tag tag-warn">Stuck</span>}
                </div>
                <div className={`heat ${heatClass(c)} ic-skill-heat`}>{c === null ? "Not yet" : percent(c)}</div>
                <div className="tiny muted ic-num">
                  {a === null ? "No starting point check yet" : b === null ? `Starting point check: ${percent(a)}` : `Checks: ${percent(a)} at start, ${percent(b)} at the end`}
                </div>
              </div>
            );
          })}
        </div>
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
                        {flaggedAttempts.has(a.id) && <span className="tag tag-warn ic-gap">On your list</span>}
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

const REASON_TAG: Record<StudentReason["kind"], string> = { support: "tag-fail", stuck: "tag-warn", review: "tag-info", safety: "tag-quiet" };

/** Why this student is on the instructor's list: what happened, when, and what to do. */
function WhyCard({ first, reasons, handled, studentId }: { first: string; reasons: StudentReason[]; handled: SafetyFlagRow[]; studentId: string }) {
  if (!reasons.length && !handled.length) return null;
  return (
    <section className={`card ic-why${reasons.some((r) => r.kind === "support") ? " is-urgent" : ""}`} id="why" data-testid="why-card">
      <h2>{reasons.length ? `Why ${first} is on your list` : `${first} is not on your list right now`}</h2>
      {reasons.map((r, i) => (
        <div key={`${r.kind}-${i}`} className="ic-reason" data-testid="why-reason" data-kind={r.kind}>
          <div className="row ic-need-head">
            <span className={`tag ${REASON_TAG[r.kind]}`}>{r.headline}</span>
            <span className="small muted">{r.kind === "stuck" ? `Latest try ${dayText(r.at)}` : whenText(r.at)}</span>
          </div>
          {r.what.map((w) => (
            <p key={w} className="ic-reason-line">
              {w}
            </p>
          ))}
          {r.stuck && (
            <div className="ic-tries" data-testid="check-history">
              {r.stuck.looksLike && (
                <p className="small ic-reason-line">
                  <b>The coach looks for:</b> {r.stuck.looksLike}
                </p>
              )}
              <div className="tiny muted">Their tries on this check, oldest first</div>
              <ol className="ic-try-list">
                {r.stuck.history.map((h) => (
                  <li key={h.attempt_id}>
                    <Link href={studentHref(studentId, h.attempt_id)} className={`ic-try ${h.pass ? "is-pass" : "is-fail"}`} title={`${exerciseTitle(h.exercise_id)}, ${shortDate(h.created_at)}`}>
                      <span aria-hidden>{h.pass ? "\u2713" : "\u2717"}</span>
                      <span className="sr-only">{h.pass ? "Passed" : "Missed"}</span>
                      <span>{exerciseTitle(h.exercise_id)}</span>
                      <span className="muted">{shortDate(h.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="ic-todo">
            <b>What to do:</b> {r.todo}
          </div>
          {(r.attempt_id || r.flag_id !== undefined) && (
            <div className="row">
              {r.attempt_id && (
                <Link href={`${studentHref(studentId, r.attempt_id)}#replay`} className={`btn ${i === 0 ? "btn-primary" : ""}`}>
                  {r.action}
                </Link>
              )}
              {r.flag_id !== undefined && (
                <ResolveFlagForm
                  flagId={r.flag_id}
                  label={r.kind === "support" ? "I checked in with them" : "Mark as handled"}
                  placeholder={r.kind === "support" ? "For example: Talked after class, connected with Student Support" : "What you did"}
                />
              )}
            </div>
          )}
        </div>
      ))}
      {handled.length > 0 && (
        <div className="ic-handled">
          <div className="tiny muted">Handled</div>
          {handled.map((f) => (
            <div key={f.id} className="small">
              {f.kind === "distress" ? "Support check-in" : "Flag closed"}
              {f.resolved_at && ` ${dayText(f.resolved_at)}`}
              {f.resolution_note && <span className="muted">: {f.resolution_note}</span>}
            </div>
          ))}
        </div>
      )}
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
    <div className="stack" data-testid="attempt-replay" id="replay">
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
