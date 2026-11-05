import type { AttemptView } from "@/lib/attempts";
import { CheckList } from "./CheckList";
import { StatusTag } from "./Tags";

/** The coach's verdict on one attempt: score, rubric checks with quoted evidence, and the one tip. */
export function AttemptResult({ exerciseId, attempt, compact = false }: { exerciseId: string; attempt: AttemptView; compact?: boolean }) {
  return (
    <div className="stack" data-testid="attempt-result">
      <div className="row between">
        <div className="row">
          <h2 style={{ margin: 0 }}>Attempt {attempt.attemptNo}</h2>
          <StatusTag status={attempt.status} />
        </div>
        {attempt.passed !== null && (
          <span className="stat" data-testid="attempt-score">
            {attempt.passed}/{attempt.total}
            <span className="stat-label"> checks passed</span>
          </span>
        )}
      </div>
      {attempt.piiRemoved && (
        <div className="notice notice-warn small">Personal details were removed before anything was sent to the AI: {attempt.piiRemoved}.</div>
      )}
      {attempt.message && <div className={`notice ${attempt.status === "distress" ? "notice-warn" : "notice-info"}`} style={{ whiteSpace: "pre-wrap" }}>{attempt.message}</div>}
      {attempt.tip && (
        <div className="tip" data-testid="coach-tip">
          <b>Coach tip:</b> {attempt.tip}
        </div>
      )}
      {attempt.checks.length > 0 && <CheckList exerciseId={exerciseId} checks={attempt.checks} />}
      {!compact && attempt.status !== "distress" && (
        <p className="small muted">These scores are drafts from an AI coach. Your instructor reviews them and can change any score.</p>
      )}
    </div>
  );
}
