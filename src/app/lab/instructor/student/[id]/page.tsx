import { CheckList, type CheckLike } from "@/components/CheckList";
import { LimitLog } from "@/components/LimitLog";
import { SampleTag, StatusTag } from "@/components/Tags";
import { Button } from "@/design/Button";
import { CoachPanel } from "@/design/CoachPanel";
import { Icon } from "@/design/icons";
import { Sheet } from "@/design/Sheet";
import { Crumbs, Fold, Panel, RowLink, Section } from "@/design/Structure";
import { getExercise } from "@/lib/curriculum/exercises";
import { SKILL_LABELS, SKILLS } from "@/lib/curriculum/types";
import { practiceOnly, skillLevels } from "@/lib/insights";
import {
  attemptReplay,
  checkRowsFor,
  dayText,
  exerciseTitle,
  findCheck,
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
import { MAX_DAILY_TOKENS, MIN_DAILY_TOKENS } from "@/lib/coach/budget";
import { capStatus, overridesFor, tokens, type CapOverride, type CapStatus } from "@/lib/cost-data";
import { scoreChecks } from "@/lib/progress";
import { requireRole } from "@/lib/session";
import { DailyLimitForm, OverrideForm, ResolveFlagForm } from "../../ConsoleButtons";
import { percent, sectionHref, shortDate, studentHref } from "../../links";

const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ attempt?: string }> }) {
  const viewer = await requireRole("instructor");
  const { id } = await params;
  const { attempt: attemptId } = await searchParams;
  const student = await studentById(decodeURIComponent(id));

  if (!student) {
    return (
      <div className="ds-page st-page st-narrow">
        <Crumbs items={[{ label: "Your sections", href: "/lab/instructor" }, { label: "Student not found" }]} />
        <Sheet className="ds-rise">
          <Section title="Student not found">
            <Panel>
              <p className="st-said" data-ok="no" data-testid="no-access">
                <Icon name="minus" />
                <span>That student is not in your sections.</span>
              </p>
            </Panel>
          </Section>
        </Sheet>
      </div>
    );
  }

  const [attempts, rows, replay, flags, overview, cap, limitChanges] = await Promise.all([
    studentAttempts(student.id),
    checkRowsFor([student.id]),
    attemptId ? attemptReplay(attemptId) : Promise.resolve(null),
    studentFlags(student.id),
    sectionOverview(student.section_id),
    capStatus(student.id),
    overridesFor([student.id], 5),
  ]);
  const reasons = studentReasons(student, rows, attempts, flags, overview.stuck);
  const handled = flags.filter((f) => f.status === "resolved");
  const stuckSkills = new Set(reasons.flatMap((r) => (r.stuck ? [r.stuck.skill] : [])));
  const flaggedAttempts = new Set(reasons.flatMap((r) => (r.attempt_id ? [r.attempt_id] : [])));
  const first = student.display_name.split(" ")[0]!;
  const levels = skillLevels(practiceOnly(rows)).get(student.id);
  const checkRows = rows.map((r) => ({
    exercise_id: r.exercise_id ?? "",
    skill: r.skill,
    pass: r.pass,
  }));
  const start = scoreChecks(checkRows, "start");
  const final = scoreChecks(checkRows, "final");
  const ok = replay && replay.student_id === student.id ? replay : null;

  const ATTEMPTS_SHOWN = 6;
  // Keep the open attempt in the first list, even when it is an older one.
  const openIndex = attempts.findIndex((a) => a.id === attemptId);
  const shownAttempts = Math.max(ATTEMPTS_SHOWN, openIndex + 1);
  const attemptRow = (a: (typeof attempts)[number]) => {
    const open = a.id === attemptId;
    return (
      <li key={a.id}>
        <RowLink
          href={`${studentHref(student.id, a.id)}#replay`}
          aria-current={open ? "true" : undefined}
          className={open ? "is-open" : undefined}
          title={exerciseTitle(a.exercise_id)}
          meta={`Attempt ${a.attempt_no} · ${shortDate(a.created_at)}${a.released_at ? " · Released" : ""}`}
          end={
            <span className="st-attempt-end">
              {flaggedAttempts.has(a.id) && (
                <span className="st-flagtext">
                  <Icon name="flag" />
                  On your list
                </span>
              )}
              {a.status !== "scored" && <StatusTag status={a.status} />}
              <span className="ds-num st-attempt-score">{a.passed !== null ? `${a.passed} of ${a.total}` : "–"}</span>
            </span>
          }
        />
      </li>
    );
  };

  return (
    <div className="ds-page st-page" data-testid="student-detail">
      <Crumbs items={[{ label: `Section ${student.section_id}`, href: sectionHref(student.section_id) }, { label: student.display_name }]} />
      <div className="ds-work">
        <Sheet>
          <header className="st-head ds-rise" style={rise(0)}>
            <div>
              <p className="ds-kicker">
                {student.id} · {student.track}
              </p>
              <h1 className="ds-sheet-title">{student.display_name}</h1>
              <SampleTag />
            </div>
          </header>

          <WhyCard first={first} reasons={reasons} handled={handled} studentId={student.id} />

          {attemptId && !ok && (
            <Section title="Attempt not available" className="ds-rise" style={rise(2)}>
              <Panel>
                <p className="st-said" data-ok="no">
                  <Icon name="minus" />
                  <span>That attempt is not available.</span>
                </p>
              </Panel>
            </Section>
          )}
          {ok && <Replay attempt={ok} />}

          <Section title="Attempts" id="attempts" className="ds-rise" style={rise(3)} aside={attempts.length > 0 ? `${attempts.length} in all` : undefined}>
            {attempts.length === 0 ? (
              <Panel>
                <p>No attempts yet.</p>
              </Panel>
            ) : (
              <>
                <Panel list data-testid="attempt-list">
                  <ol className="ds-rows">{attempts.slice(0, shownAttempts).map((a) => attemptRow(a))}</ol>
                </Panel>
                {attempts.length > shownAttempts && (
                  <Fold label={`Show ${attempts.length - shownAttempts} older attempts`}>
                    <ol className="ds-rows st-flush">{attempts.slice(shownAttempts).map((a) => attemptRow(a))}</ol>
                  </Fold>
                )}
              </>
            )}
          </Section>

          <Section title="Skills" id="skills" data-testid="student-skills" className="ds-rise" style={rise(4)} desc="Checks passed on the last 3 practice tries.">
            <Panel list>
              <ul className="ds-rows">
                {SKILLS.map((s) => {
                  const c = levels?.[s].current ?? null;
                  const a = start[s];
                  const b = final[s];
                  const stuck = stuckSkills.has(s);
                  return (
                    <li key={s} className="ds-row st-row" data-testid={stuck ? "stuck-skill" : undefined}>
                      <span className="st-row-main">
                        <span className="st-row-title">{SKILL_LABELS[s]}</span>
                        <span className="st-row-meta">
                          {a === null
                            ? "No starting point check yet"
                            : b === null
                              ? `Starting point check ${percent(a)}`
                              : `Checks ${percent(a)} at the start, ${percent(b)} at the end`}
                        </span>
                      </span>
                      {stuck && (
                        <span className="st-flagtext">
                          <Icon name="minus" />
                          Stuck
                        </span>
                      )}
                      <span className="st-cell ds-num" data-band={c === null ? "na" : c < 0.4 ? "low" : c < 0.7 ? "mid" : "high"}>
                        {c === null ? "Not yet" : percent(c)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </Section>

          {cap && <DailyLimit studentId={student.id} first={first} cap={cap} changes={limitChanges} viewerId={viewer.userId} />}
        </Sheet>

        <CoachDraft attempt={ok} first={first} />
      </div>
    </div>
  );
}

/** The student's daily token limit, today's use, the form to change it, and the last few changes. Totals only. */
function DailyLimit({ studentId, first, cap, changes, viewerId }: { studentId: string; first: string; cap: CapStatus; changes: CapOverride[]; viewerId: string }) {
  const share = cap.daily_tokens > 0 ? Math.min(1, cap.used_today / cap.daily_tokens) : 0;
  const changed = cap.override !== null && cap.daily_tokens !== cap.default_tokens;
  return (
    <Section title="Daily limit" id="limit" data-testid="daily-limit" className="ds-rise" style={rise(5)} desc={`When ${first} reaches the limit, new attempts are saved and scored the next day.`}>
      <Panel className="st-stack">
        <dl className="ds-rows st-kv">
          <div className="st-kv-row">
            <dt>Limit</dt>
            <dd>
              <b className="ds-num" data-testid="limit-current">
                {tokens(cap.daily_tokens)} tokens
              </b>
              <span>{changed ? `Default is ${tokens(cap.default_tokens)}` : "Default for every student"}</span>
            </dd>
          </div>
          <div className="st-kv-row">
            <dt>Used today</dt>
            <dd>
              <b className="ds-num" data-testid="limit-used">
                {tokens(cap.used_today)} tokens
              </b>
              <span>{Math.round(share * 100)}% of the limit</span>
            </dd>
          </div>
        </dl>
        <span className="ds-track st-limit-bar" role="img" aria-label={`${Math.round(share * 100)}% of today's limit used`}>
          <i style={{ width: `${Math.round(share * 100)}%` }} />
        </span>
      </Panel>
      <Panel className="st-stack">
        <h3>Change the limit</h3>
        <DailyLimitForm studentId={studentId} current={cap.daily_tokens} min={MIN_DAILY_TOKENS} max={MAX_DAILY_TOKENS} />
      </Panel>
      {changes.length > 0 && (
        <Fold label="Recent changes" hint={`${changes.length} logged`}>
          <LimitLog rows={changes} actor={(id) => (id === viewerId ? "You" : "Another facilitator")} bare />
        </Fold>
      )}
    </Section>
  );
}

function checksOf(attempt: AttemptReplay): CheckLike[] {
  return attempt.check_results.map((c) => ({
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
}

/** The coach's draft for the open attempt, in the side panel. The facilitator decides; the override form is in the sheet. */
function CoachDraft({ attempt, first }: { attempt: AttemptReplay | null; first: string }) {
  if (!attempt) {
    return <CoachPanel heading="Coach's draft" empty={`Open one of ${first}'s attempts to see the coach's draft scores.`} className="st-coach" />;
  }
  const checks = checksOf(attempt);
  return (
    <CoachPanel
      heading="Coach's draft"
      score={attempt.passed !== null ? `${attempt.passed} of ${attempt.total}` : undefined}
      empty={attempt.status === "distress" ? "No scores. Support messages skip the coach." : "No checks scored yet."}
      tip={attempt.tip ? <span data-testid="coach-tip">{attempt.tip}</span> : undefined}
      className="st-coach"
    >
      {checks.length > 0 ? <CheckList exerciseId={attempt.exercise_id} checks={checks} staff /> : undefined}
    </CoachPanel>
  );
}

/** Why this student is on the facilitator's list: what happened, when, and what to do. */
function WhyCard({ first, reasons, handled, studentId }: { first: string; reasons: StudentReason[]; handled: SafetyFlagRow[]; studentId: string }) {
  if (!reasons.length && !handled.length) return null;
  return (
    <Section title={reasons.length ? `Why ${first} is on your list` : `${first} is not on your list right now`} id="why" data-testid="why-card" className="ds-rise" style={rise(1)}>
      {reasons.map((r, i) => (
        <div key={`${r.kind}-${i}`} className="st-reason" data-testid="why-reason" data-kind={r.kind}>
          <Panel className="st-stack">
            <div className="st-reason-head">
              <h3>
                <Icon name={r.kind === "support" || r.kind === "safety" ? "flag" : r.kind === "review" ? "clock" : "minus"} />
                {r.headline}
              </h3>
              <span>{r.kind === "stuck" ? `Latest try ${dayText(r.at)}` : whenText(r.at)}</span>
            </div>
            {r.what.map((w) => (
              <p key={w}>{w}</p>
            ))}
            {r.stuck?.looksLike && (
              <p>
                <b>The coach looks for:</b> {r.stuck.looksLike}
              </p>
            )}
            <p>
              <b>What to do:</b> {r.todo}
            </p>
            {(r.attempt_id || r.flag_id !== undefined) && (
              <div className="st-act-row">
                {r.attempt_id && (
                  <Button href={`${studentHref(studentId, r.attempt_id)}#replay`} variant={i === 0 ? "primary" : "secondary"}>
                    {r.action}
                  </Button>
                )}
                {r.flag_id !== undefined && (
                  <ResolveFlagForm
                    flagId={r.flag_id}
                    primary={i === 0 && !r.attempt_id}
                    label={r.kind === "support" ? "I checked in with them" : "Mark as handled"}
                    placeholder={r.kind === "support" ? "For example: Talked after class, connected with Student Support" : "What you did"}
                  />
                )}
              </div>
            )}
          </Panel>
          {r.stuck && (
            <Fold label={`Their ${r.stuck.history.length} tries on this check`} hint="Oldest first. Each one opens that attempt." data-testid="check-history">
              <ol className="ds-rows st-flush">
                {r.stuck.history.map((h) => (
                  <li key={h.attempt_id}>
                    <RowLink
                      href={`${studentHref(studentId, h.attempt_id)}#replay`}
                      data-pass={h.pass ? "yes" : "no"}
                      title={
                        <>
                          <Icon name={h.pass ? "check" : "minus"} className="ds-icon st-try-icon" />
                          <span className="ds-sr">{h.pass ? "Passed: " : "Missed: "}</span>
                          {exerciseTitle(h.exercise_id)}
                        </>
                      }
                      end={shortDate(h.created_at)}
                    />
                  </li>
                ))}
              </ol>
            </Fold>
          )}
        </div>
      ))}
      {handled.length > 0 && (
        <Fold label="Already handled" hint={`${handled.length} closed`}>
          {handled.map((f) => (
            <p key={f.id} className="st-handled">
              <b>{f.kind === "distress" ? "Support check-in" : "Flag closed"}</b>
              {f.resolved_at && ` ${dayText(f.resolved_at)}`}
              {f.resolution_note && `: ${f.resolution_note}`}
            </p>
          ))}
        </Fold>
      )}
    </Section>
  );
}

function str(x: unknown): string {
  return typeof x === "string" ? x : "";
}

function Replay({ attempt }: { attempt: AttemptReplay }) {
  const ex = getExercise(attempt.exercise_id);
  const input = attempt.input ?? {};
  const output = attempt.output ?? {};
  const outputs =
    Array.isArray(output.outputs) && output.outputs.length
      ? (output.outputs as {
          model: string;
          text: string;
          latencyMs?: number;
          costUsd?: number;
        }[])
      : null;
  const transcript =
    Array.isArray(output.transcript) && output.transcript.length
      ? (output.transcript as {
          id: string;
          from: string;
          text: string;
          reply: string;
        }[])
      : null;
  const written = [str(input.instructions), str(input.prompt), str(input.answer)].filter(Boolean);
  const isCheck = attempt.studio === "check";
  const order = (k: string) => {
    const i = ex?.checks.findIndex((c) => c.key === k) ?? 0;
    return i < 0 ? 99 : i;
  };
  const label = (k: string) => ex?.checks.find((c) => c.key === k)?.text ?? findCheck(k)?.text ?? k;
  const review = attempt.check_results.some((c) => c.needs_review);

  return (
    <Section
      title={exerciseTitle(attempt.exercise_id)}
      id="replay"
      data-testid="attempt-replay"
      className="ds-rise"
      desc={`Attempt ${attempt.attempt_no} · ${shortDate(attempt.created_at)}`}
      aside={
        attempt.passed !== null ? (
          <span data-testid="replay-score">
            {attempt.passed} of {attempt.total} checks passed
          </span>
        ) : undefined
      }
    >
      <Panel className="st-stack">
        <p className="st-meta">
          <StatusTag status={attempt.status} />
          <span className="ds-note">{attempt.released_at ? "Released to the student" : "Not released yet"}</span>
          <span className="ds-note">Your view of this attempt is logged</span>
        </p>
        <div className="st-sub">
          <h3>What the student wrote</h3>
          {written.map((t, i) => (
            <pre key={i} className="st-pre" data-testid="replay-input">
              {t}
            </pre>
          ))}
          {str(input.pickedModel) && (
            <p>
              Picked: <b>{str(input.pickedModel)}</b>
            </p>
          )}
          {str(input.reasoning) && <pre className="st-pre">{str(input.reasoning)}</pre>}
          {!written.length && !str(input.reasoning) && <p>{attempt.status === "distress" ? "Not stored. Support messages are never saved." : "Nothing saved."}</p>}
        </div>
      </Panel>

      {!isCheck && (
        <Panel className="st-stack">
          <div className="st-sub">
            <h3>What the AI produced</h3>
            {str(output.text) && (
              <pre className="st-pre st-pre-ai" data-testid="replay-output">
                {str(output.text)}
              </pre>
            )}
            {outputs && (
              <div className="st-outs" data-testid="replay-output">
                {outputs.map((o) => (
                  <div key={o.model}>
                    <p className="st-out-head">
                      <b>{o.model}</b>
                      {o.latencyMs !== undefined && <span> · {(o.latencyMs / 1000).toFixed(1)}s</span>}
                      {o.costUsd !== undefined && <span> · ${o.costUsd.toFixed(4)}</span>}
                      {o.model === str(input.pickedModel) && <span> · Picked</span>}
                    </p>
                    <pre className="st-pre st-pre-ai">{o.text}</pre>
                  </div>
                ))}
              </div>
            )}
            {transcript && (
              <div className="st-outs" data-testid="replay-output">
                {transcript.map((t) => (
                  <div key={t.id}>
                    <p className="st-out-head">
                      <b>{t.from}:</b> <span>{t.text}</span>
                    </p>
                    <pre className="st-pre st-pre-ai">{t.reply}</pre>
                  </div>
                ))}
              </div>
            )}
            {!str(output.text) && !outputs && !transcript && <p>No output saved.</p>}
          </div>
        </Panel>
      )}

      {attempt.check_results.length > 0 && (
        <Fold label="Change a score" hint="Your note is saved with the change and recorded in the audit log." open={review} data-testid="override-panel">
          {review && (
            <p className="st-said" data-ok="no">
              <Icon name="minus" />
              <span>The coach could not confirm a quote on at least one check. Check it and save your call.</span>
            </p>
          )}
          <div className="st-ovs">
            {[...attempt.check_results]
              .sort((a, b) => order(a.check_key) - order(b.check_key))
              .map((c) => (
                <OverrideForm key={`${attempt.id}-${c.check_key}`} attemptId={attempt.id} checkKey={c.check_key} label={label(c.check_key)} pass={c.pass} />
              ))}
          </div>
        </Fold>
      )}
    </Section>
  );
}
