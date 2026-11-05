import type { AttemptView } from "@/lib/attempts";
import { PASS_MARK } from "@/lib/curriculum/course";
import { getExercise } from "@/lib/curriculum/exercises";
import { CheckList } from "./CheckList";
import { StatusTag } from "./Tags";

/** The coach's verdict on one attempt: score, the one tip, then each rubric check with quoted evidence. */
export function AttemptResult({ exerciseId, attempt, compact = false }: { exerciseId: string; attempt: AttemptView; compact?: boolean }) {
  // Skills-check tasks are not pass/fail, so they keep the plain status tag.
  const scored = attempt.status === "scored" && attempt.passed !== null && !!attempt.total && getExercise(exerciseId)?.studio !== "check";
  const passed = scored && attempt.passed! / attempt.total! >= PASS_MARK;
  const Title = compact ? "h3" : "h2";
  return (
    <div className="result stack" data-testid="attempt-result">
      <div className="result-head">
        <div className="row" style={{ gap: 8 }}>
          <Title style={{ margin: 0 }}>Attempt {attempt.attemptNo}</Title>
          {scored ? <span className={`tag ${passed ? "tag-pass" : "tag-quiet"}`}>{passed ? "Passed" : "Not passed yet"}</span> : <StatusTag status={attempt.status} />}
        </div>
        {attempt.passed !== null && (
          <span className="result-score" data-testid="attempt-score">
            {attempt.passed}/{attempt.total}
            <span className="stat-label"> checks passed</span>
          </span>
        )}
      </div>
      {attempt.piiRemoved && <div className="notice notice-warn small">Personal details were removed before anything was sent to the AI: {attempt.piiRemoved}.</div>}
      {attempt.message && (
        <div className={`notice ${attempt.status === "distress" ? "notice-warn" : "notice-info"}`} style={{ whiteSpace: "pre-wrap" }}>
          {attempt.message}
        </div>
      )}
      {attempt.tip && (
        <div className="tip" data-testid="coach-tip">
          <div className="eyebrow" style={{ color: "var(--accent-ink)" }}>Coach tip</div>
          {attempt.tip}
        </div>
      )}
      {attempt.checks.length > 0 && <CheckList exerciseId={exerciseId} checks={attempt.checks} />}
      {!compact && attempt.status !== "distress" && (
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          The AI coach drafts these scores. Your instructor reviews them and can change any score.
        </p>
      )}
    </div>
  );
}
