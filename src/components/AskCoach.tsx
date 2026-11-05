"use client";

import { useState, useTransition } from "react";
import { askLessonCoachAction } from "@/app/lab/actions";

/** "Ask the coach about this lesson". Answers only from the current lesson. */
export function AskCoach({ exerciseId, module }: { exerciseId: string; module: string }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{ text?: string; error?: string; distress?: boolean } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card card-muted">
      <h3>Ask the coach about {module}</h3>
      <p className="small muted">An AI coach. It answers questions about this lesson and won&apos;t write your answer for you.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setAnswer(await askLessonCoachAction(exerciseId, q)));
        }}
        className="row"
      >
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What does the G in R-T-G mean?" style={{ flex: 1 }} aria-label="Question for the coach" />
        <button className="btn" disabled={pending || !q.trim()}>
          {pending ? "Thinking…" : "Ask the coach"}
        </button>
      </form>
      {answer?.error && <div className="notice notice-fail" style={{ marginTop: "0.6rem" }}>{answer.error}</div>}
      {answer?.text && (
        <div className={`notice ${answer.distress ? "notice-warn" : "notice-info"}`} style={{ marginTop: "0.6rem", whiteSpace: "pre-wrap" }} data-testid="coach-answer">
          {answer.text}
        </div>
      )}
    </div>
  );
}
