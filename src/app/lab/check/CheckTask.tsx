"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { AttemptView } from "@/lib/attempts";
import { submitCheckAction } from "@/app/lab/actions";
import { CheckResult } from "./CheckResult";

/** One check task: the answer box, then the coach's feedback and the way on. */
export function CheckTask({
  exerciseId,
  question,
  checkTexts,
  initial,
  initialAnswer,
  nextHref,
  nextLabel,
}: {
  exerciseId: string;
  question: string;
  checkTexts: Record<string, string>;
  initial: AttemptView | null;
  initialAnswer: string;
  nextHref: string;
  nextLabel: string;
}) {
  const [result, setResult] = useState<AttemptView | null>(initial);
  const [submitted, setSubmitted] = useState(initialAnswer);
  const [answer, setAnswer] = useState(initialAnswer);
  const [editing, setEditing] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    setError(null);
    startTransition(async () => {
      const r = await submitCheckAction(exerciseId, answer);
      if (r.ok) {
        setResult(r.attempt);
        setSubmitted(answer);
        setEditing(false);
      } else {
        setError(r.error);
      }
    });
  }

  if (editing || !result) {
    return (
      <form onSubmit={submit}>
        <label htmlFor="check-answer" style={{ fontSize: 16 }}>
          {question}
        </label>
        <textarea
          id="check-answer"
          data-testid="check-answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          maxLength={3000}
          rows={6}
          disabled={pending}
          placeholder="Write your answer in a few sentences."
        />
        {error && (
          <div className="notice notice-fail small" role="alert" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
        <div className="form-foot">
          <span className="tiny muted" aria-live="polite">
            {pending ? "The coach is reading your answer." : "The coach checks your answer and gives one tip."}
          </span>
          <div className="row">
            {result && !pending && (
              <button type="button" className="btn btn-subtle" onClick={() => { setAnswer(submitted); setEditing(false); setError(null); }}>
                Keep my last answer
              </button>
            )}
            <button type="submit" className="btn btn-primary" data-testid="check-submit" disabled={pending || !answer.trim()}>
              {pending ? "Checking…" : "Submit answer"}
            </button>
          </div>
        </div>
      </form>
    );
  }

  if (result.status === "distress") return <CheckResult attempt={result} checkTexts={checkTexts} />;

  return (
    <div className="stack">
      {submitted && (
        <div>
          <div className="material-label">Your answer</div>
          <div className="answer-text">{submitted}</div>
        </div>
      )}
      <CheckResult attempt={result} checkTexts={checkTexts} />
      <div className="form-foot" style={{ marginTop: 8 }}>
        <button type="button" className="btn btn-subtle" onClick={() => setEditing(true)} data-testid="check-again">
          Answer again
        </button>
        <Link href={nextHref} className="btn btn-primary" data-testid="check-next">
          {nextLabel}
        </Link>
      </div>
    </div>
  );
}
