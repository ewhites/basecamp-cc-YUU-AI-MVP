"use client";

import { useState, useTransition } from "react";
import { askLessonCoachAction } from "@/app/lab/actions";

const EXAMPLE_QUESTION: Record<string, string> = {
  M01: "For example: what counts as a guardrail?",
  M02: "For example: what does Trust mean here?",
  M03: "For example: what makes a good handoff?",
};

/**
 * "Ask the coach about this lesson": a quiet, collapsed panel. The coach answers only from the
 * current lesson and won't write the student's answer. `module` picks the example question.
 */
export function AskCoach({ exerciseId, module }: { exerciseId: string; module?: string }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{ text?: string; error?: string; distress?: boolean } | null>(null);
  const [pending, start] = useTransition();
  return (
    <details className="quiet-panel" data-testid="ask-coach">
      <summary>Ask the coach about this lesson</summary>
      <div className="stack-sm" style={{ marginTop: 10 }}>
        <p className="small muted" style={{ margin: 0 }}>It answers questions about this lesson. It won&apos;t write your answer for you.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => setAnswer(await askLessonCoachAction(exerciseId, q)));
          }}
          className="row"
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={EXAMPLE_QUESTION[module ?? ""] ?? "Ask about this lesson"}
            style={{ flex: 1, minWidth: 200 }}
            aria-label="Question for the coach"
            data-testid="ask-coach-input"
          />
          <button className="btn" disabled={pending || !q.trim()} data-testid="ask-coach-submit">
            {pending ? "Thinking…" : "Ask"}
          </button>
        </form>
        {answer?.error && <div className="notice notice-fail small">{answer.error}</div>}
        {answer?.text && (
          <div className={`notice ${answer.distress ? "notice-warn" : "notice-info"} small`} style={{ whiteSpace: "pre-wrap" }} data-testid="coach-answer">
            {answer.text}
          </div>
        )}
      </div>
    </details>
  );
}
