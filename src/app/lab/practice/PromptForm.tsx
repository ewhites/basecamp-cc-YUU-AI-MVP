"use client";

import { useState, useTransition } from "react";
import { submitPromptAction } from "@/app/lab/actions";
import { AttemptResultClient } from "@/components/AttemptResultClient";
import type { AttemptView } from "@/lib/attempts";
import { attemptPassed, NextStep, type NextLink } from "./NextStep";

type Latest = (AttemptView & { input?: unknown }) | null;

function lastPrompt(latest: Latest): string {
  const input = latest?.input;
  return typeof input === "object" && input && "prompt" in input ? String((input as { prompt: string }).prompt) : "";
}

/** Module 1 practice: write a prompt, see what the AI does with it, get scored. */
export function PromptForm({ exerciseId, latest, next, alreadyDone = false }: { exerciseId: string; latest: Latest; next: NextLink | null; alreadyDone?: boolean }) {
  const [prompt, setPrompt] = useState(lastPrompt(latest));
  const [attempt, setAttempt] = useState<AttemptView | null>(latest);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const words = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;
  const output = attempt?.output && "text" in attempt.output ? attempt.output : null;
  const passed = alreadyDone || attemptPassed(attempt);

  return (
    <>
      <section className="card">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await submitPromptAction(exerciseId, prompt);
              if (r.ok) setAttempt(r.attempt);
              else setError(r.error);
            });
          }}
        >
          <div>
            <label htmlFor="prompt">Your prompt</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Role, then Task, then Guardrails. The attached material is added for you."
              data-testid="prompt-input"
            />
          </div>
          <div className="form-foot">
            <span className={`small ${words > 200 ? "text-bad" : "muted"}`}>{words} of 200 words</span>
            <button className={`btn ${passed ? "" : "btn-primary"}`} disabled={pending || !prompt.trim()} data-testid="submit-prompt">
              {pending ? "Running and scoring…" : attempt ? "Run my new version" : "Run and score"}
            </button>
          </div>
          {pending && <div className="notice notice-info small">Running your prompt, then checking it. About 10 seconds.</div>}
          {error && <div className="notice notice-fail">{error}</div>}
        </form>
      </section>

      {output?.text && (
        <section className="card stack-sm">
          <div className="row between">
            <h2 style={{ margin: 0 }}>What the AI wrote</h2>
            {output.model && <span className="tiny muted">{output.model}</span>}
          </div>
          <pre data-testid="ai-output">{output.text}</pre>
        </section>
      )}

      {attempt && (
        <section className="card">
          <AttemptResultClient exerciseId={exerciseId} attempt={attempt} />
        </section>
      )}

      {passed && <NextStep next={next} />}
    </>
  );
}
