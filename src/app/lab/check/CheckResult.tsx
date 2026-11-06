import type { AttemptView } from "@/lib/attempts";

/**
 * Compact feedback on one check task: how many checks you met, each check with your own
 * words as evidence, and the coach's one tip. Distress shows the staff-contact message only.
 */
export function CheckResult({ attempt, checkTexts }: { attempt: AttemptView; checkTexts: Record<string, string> }) {
  if (attempt.status === "distress") {
    return (
      <div className="notice notice-warn" style={{ whiteSpace: "pre-wrap" }} data-testid="check-distress">
        {attempt.message}
      </div>
    );
  }

  if (attempt.status === "pending_score") {
    return (
      <div className="notice notice-info" data-testid="check-pending">
        <b>Your answer is saved.</b> {attempt.message ?? "The coach will score it soon. Your result will show here."}
      </div>
    );
  }

  const order = Object.keys(checkTexts);
  const checks = [...attempt.checks].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return (
    <div className="stack" data-testid="check-result">
      <div className="row between">
        <h2 style={{ margin: 0 }}>How you did</h2>
        {attempt.passed !== null && (
          <span className="small muted" data-testid="check-score">
            {attempt.passed} of {attempt.total} checks met
          </span>
        )}
      </div>
      {attempt.piiRemoved && (
        <div className="notice notice-warn small">Personal details were removed before anything went to the AI: {attempt.piiRemoved}.</div>
      )}
      {attempt.status === "needs_review" && (
        <div className="notice notice-warn small">Your instructor will check the items marked for review.</div>
      )}
      <ul className="checks">
        {checks.map((c) => {
          const state = c.needsReview ? "review" : c.pass ? "pass" : "fail";
          const quoteOk = c.evidence && c.evidenceVerified !== false;
          return (
            <li key={c.key} className="check" data-testid={`check-${c.key}`} data-state={state}>
              <span className={`check-icon ${state}`} aria-label={state === "pass" ? "Met" : state === "review" ? "Needs review" : "Not yet"}>
                {state === "pass" ? "✓" : state === "review" ? "?" : "✕"}
              </span>
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <b>{checkTexts[c.key] ?? c.key}</b>
                  {c.needsReview && <span className="tag tag-warn">Needs review</span>}
                </div>
                {quoteOk && (
                  <div className="small" style={{ marginTop: 2 }}>
                    Your words: <span className="evidence">“{c.evidence}”</span>
                  </div>
                )}
                {c.reason && <div className="small muted">{c.reason}</div>}
              </div>
            </li>
          );
        })}
      </ul>
      {attempt.tip && (
        <div className="tip" data-testid="coach-tip">
          <b>One tip:</b> {attempt.tip}
        </div>
      )}
    </div>
  );
}
