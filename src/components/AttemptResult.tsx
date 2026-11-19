import type { AttemptView } from "@/lib/attempts";
import { PASS_MARK } from "@/lib/curriculum/course";
import { getExercise } from "@/lib/curriculum/exercises";
import { CheckList } from "./CheckList";
import { StatusTag } from "./Tags";

/** The quotes of an attempt's checks, in check order (for highlighting the student's own text). */
export function attemptQuotes(attempt: Pick<AttemptView, "checks"> | null | undefined): string[] {
  return (attempt?.checks ?? []).filter((c) => c.evidence && c.evidenceVerified !== false && c.method !== "code").map((c) => c.evidence);
}

/**
 * The coach's verdict on one attempt, for the coach side panel: the score, which attempt, each check with the
 * student's quoted words, then the one tip. Distress shows the staff-contact message only; a pending attempt says so.
 * compact: an earlier attempt, folded under the latest (no coach heading).
 */
export function AttemptResult({ exerciseId, attempt, compact = false }: { exerciseId: string; attempt: AttemptView; compact?: boolean }) {
  // Skills-check tasks are not pass/fail, so they keep the plain status line.
  const scored = attempt.status === "scored" && attempt.passed !== null && !!attempt.total && getExercise(exerciseId)?.studio !== "check";
  const passed = scored && attempt.passed! / attempt.total! >= PASS_MARK;
  const score =
    attempt.passed !== null ? (
      <span className="ds-coach-score" data-testid="attempt-score">
        {attempt.passed}/{attempt.total} checks
      </span>
    ) : null;
  const tipDelay = `${(attempt.checks.length + 1) * 180 + 100}ms`;
  return (
    <div className={`ln-attempt${compact ? " is-compact" : ""}`} data-testid="attempt-result">
      {compact ? (
        <div className="ln-attempt-head">
          <h3>Attempt {attempt.attemptNo}</h3>
          {score}
        </div>
      ) : (
        <div className="ds-coach-head">
          <h2>Coach</h2>
          {score}
        </div>
      )}
      <div className="ln-attempt-line">
        {!compact && <span>Attempt {attempt.attemptNo}</span>}
        {scored ? <span>{passed ? "Passed" : "Not passed yet"}</span> : <StatusTag status={attempt.status} />}
      </div>
      {attempt.piiRemoved && <p className="ln-coach-note">Personal details were removed before anything was sent to the AI: {attempt.piiRemoved}.</p>}
      {attempt.message && (
        <p className={`ln-coach-msg${attempt.status === "distress" ? " is-distress" : ""}`}>
          {attempt.message}
        </p>
      )}
      {attempt.checks.length > 0 && <CheckList exerciseId={exerciseId} checks={attempt.checks} />}
      {attempt.tip && (
        <div className="ds-tip" data-testid="coach-tip" style={{ "--tip-delay": tipDelay } as React.CSSProperties}>
          <small>One tip</small>
          <p>{attempt.tip}</p>
        </div>
      )}
      {!compact && attempt.status !== "distress" && <p className="ln-coach-fine">The AI coach drafts these scores. Your facilitator reviews them and can change any score.</p>}
    </div>
  );
}
