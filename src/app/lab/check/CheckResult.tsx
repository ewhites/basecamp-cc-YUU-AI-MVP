import { CheckList } from "@/components/CheckList";
import type { AttemptView } from "@/lib/attempts";

/**
 * The coach's feedback on one check task, for the coach panel: how many checks you met, each check with your own
 * words as evidence, and one tip. Distress shows the staff-contact message only. A pending answer says it is saved.
 */
export function CheckResult({ attempt, checkTexts, exerciseId }: { attempt: AttemptView; checkTexts: Record<string, string>; exerciseId: string }) {
  if (attempt.status === "distress") {
    return (
      <div className="ln-attempt">
        <div className="ds-coach-head">
          <h2>Coach</h2>
        </div>
        <p className="ln-coach-msg is-distress" data-testid="check-distress">
          {attempt.message}
        </p>
      </div>
    );
  }

  if (attempt.status === "pending_score") {
    return (
      <div className="ln-attempt">
        <div className="ds-coach-head">
          <h2>Coach</h2>
        </div>
        <p className="ln-coach-msg" data-testid="check-pending">
          Your answer is saved. {attempt.message ?? "The coach will score it soon. Your result will show here."}
        </p>
      </div>
    );
  }

  const tipDelay = `${(attempt.checks.length + 1) * 180 + 100}ms`;
  return (
    <div className="ln-attempt" data-testid="check-result">
      <div className="ds-coach-head">
        <h2>Coach</h2>
        {attempt.passed !== null && (
          <span className="ds-coach-score" data-testid="check-score">
            {attempt.passed} of {attempt.total} met
          </span>
        )}
      </div>
      {attempt.piiRemoved && <p className="ln-coach-note">Personal details were removed before anything went to the AI: {attempt.piiRemoved}.</p>}
      {attempt.status === "needs_review" && <p className="ln-coach-note">Your facilitator will check the items marked for review.</p>}
      <CheckList exerciseId={exerciseId} checks={attempt.checks} texts={checkTexts} />
      {attempt.tip && (
        <div className="ds-tip" data-testid="coach-tip" style={{ "--tip-delay": tipDelay } as React.CSSProperties}>
          <small>One tip</small>
          <p>{attempt.tip}</p>
        </div>
      )}
      <p className="ln-coach-fine">Not graded. Scores come from an AI coach, and your facilitator can change any score.</p>
    </div>
  );
}
