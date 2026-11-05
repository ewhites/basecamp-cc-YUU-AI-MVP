"use client";

import { useState, useTransition } from "react";
import { submitPromptAction } from "@/app/lab/actions";
import { AttemptResultClient } from "@/components/AttemptResultClient";
import type { AttemptView } from "@/lib/attempts";

export function PromptStudioForm({ exerciseId, latest }: { exerciseId: string; latest: (AttemptView & { input?: unknown }) | null }) {
  const lastPrompt = latest && typeof latest.input === "object" && latest.input && "prompt" in latest.input ? String((latest.input as { prompt: string }).prompt) : "";
  const [prompt, setPrompt] = useState(lastPrompt);
  const [attempt, setAttempt] = useState<AttemptView | null>(latest);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const words = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;
  const output = attempt?.output && "text" in attempt.output ? attempt.output : null;

  return (
    <>
      <section className="card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await submitPromptAction(exerciseId, prompt);
              if (r.ok) setAttempt(r.attempt);
              else setError(r.error);
            });
          }}
          className="stack"
        >
          <div>
            <label htmlFor="prompt">Your prompt</label>
            <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Write your prompt here. The attached material is added automatically." data-testid="prompt-input" />
          </div>
          <div className="row between">
            <span className={`small ${words >= 200 ? "" : "muted"}`}>{words} words{words >= 200 ? " (the limit is 200)" : ""}</span>
            <button className="btn btn-primary" disabled={pending || !prompt.trim()} data-testid="submit-prompt">
              {pending ? "Running and scoring…" : attempt ? "Run my new version" : "Run and score my prompt"}
            </button>
          </div>
          {pending && <div className="notice notice-info small">Running your prompt, then checking it against the rubric. About 10 seconds.</div>}
          {error && <div className="notice notice-fail">{error}</div>}
        </form>
      </section>
      {output?.text && (
        <section className="card">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Claude&apos;s output</h2>
            <span className="small muted">{output.model ?? ""}</span>
          </div>
          <pre style={{ marginTop: "0.5rem" }} data-testid="ai-output">
            {output.text}
          </pre>
        </section>
      )}
      {attempt && (
        <section className="card">
          <AttemptResultClient exerciseId={exerciseId} attempt={attempt} />
        </section>
      )}
    </>
  );
}
