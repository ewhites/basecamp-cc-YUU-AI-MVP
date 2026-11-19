"use client";

import { useState, useTransition } from "react";
import { submitPromptAction } from "@/app/lab/actions";
import { CoachSide } from "@/components/AskCoach";
import { AttemptResult, attemptQuotes } from "@/components/AttemptResult";
import { Button } from "@/design/Button";
import type { AttemptView } from "@/lib/attempts";
import { ErrorLine, Frame, Slab, type TaskHead } from "./Frame";
import { attemptPassed, NextStep, type NextLink } from "./NextStep";
import { Highlighted, WriteField } from "./WriteField";

type Latest = (AttemptView & { input?: unknown }) | null;

function lastPrompt(latest: Latest): string {
  const input = latest?.input;
  return typeof input === "object" && input && "prompt" in input ? String((input as { prompt: string }).prompt) : "";
}

/** Module 1 practice: write a prompt, see what the AI does with it, get scored. */
export function PromptForm({
  exerciseId,
  latest,
  next,
  alreadyDone = false,
  head,
}: {
  exerciseId: string;
  latest: Latest;
  next: NextLink | null;
  alreadyDone?: boolean;
  head: TaskHead;
}) {
  const [prompt, setPrompt] = useState(lastPrompt(latest));
  const [attempt, setAttempt] = useState<AttemptView | null>(latest);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const words = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;
  const output = attempt?.output && "text" in attempt.output ? attempt.output : null;
  const passed = alreadyDone || attemptPassed(attempt);
  const quotes = attemptQuotes(attempt);

  return (
    <Frame
      head={head}
      coach={
        <CoachSide
          className="ds-rise ln-i2"
          exerciseId={exerciseId}
          module={head.module}
          result={attempt ? <AttemptResult exerciseId={exerciseId} attempt={attempt} /> : undefined}
          empty="Run your prompt to see what to fix"
          earlier={head.earlier}
          next={next}
          arriveKey={attempt?.id}
        />
      }
    >
      <form
        className="ln-work"
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
        <Slab
          note={
            pending ? (
              "Running your prompt, then checking it. About 10 seconds"
            ) : (
              <>
                {attempt && <span>Try {attempt.attemptNo + 1}</span>}
                <span className={words > 200 ? "ln-over" : undefined}>{words} of 200 words</span>
              </>
            )
          }
          action={
            <Button type="submit" variant={passed ? "paper" : "primary"} disabled={pending || !prompt.trim()} data-testid="submit-prompt">
              {pending ? "Running" : attempt ? "Run new version" : "Run prompt"}
            </Button>
          }
        >
          <WriteField
            id="prompt"
            label="Your prompt"
            value={prompt}
            onChange={setPrompt}
            quotes={quotes}
            quoteKey={attempt?.id}
            placeholder="Role, then Task, then Guardrails. The attached material is added for you."
            testId="prompt-input"
          />
        </Slab>
        {error && <ErrorLine>{error}</ErrorLine>}
      </form>

      {output?.text && (
        <section className="ln-output" aria-labelledby="ai-wrote">
          <div className="ln-output-head">
            <h2 id="ai-wrote" className="ln-h">What the AI wrote</h2>
            {output.model && <span className="ds-fine">{output.model}</span>}
          </div>
          <div key={attempt?.id} className="ds-inset ds-sq ln-text" data-testid="ai-output">
            <Highlighted text={output.text} quotes={quotes} />
          </div>
        </section>
      )}

      {passed && <NextStep next={next} />}
    </Frame>
  );
}
