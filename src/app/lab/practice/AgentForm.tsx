"use client";

import { useState, useTransition } from "react";
import { submitAgentAction } from "@/app/lab/actions";
import { AttemptResultClient } from "@/components/AttemptResultClient";
import type { AttemptView } from "@/lib/attempts";
import type { CoworkerMessage } from "@/lib/curriculum/types";
import { KIND_LABELS, KIND_TAG } from "./kinds";
import { attemptPassed, NextStep, type NextLink } from "./NextStep";

type Latest = (AttemptView & { input?: unknown }) | null;

const PLACEHOLDER = `Job: what the bot does, for whom, from which source.
Tools and limits: what it must never do or promise.
Stop rule: when it says "I don't know" instead of guessing.
Handoff: who it sends people to, and how to reach them.`;

/** Module 3 practice: write a bot's instructions, test it on three coworker messages, get scored. */
export function AgentForm({
  exerciseId,
  latest,
  messages,
  next,
  alreadyDone = false,
}: {
  exerciseId: string;
  latest: Latest;
  messages: CoworkerMessage[];
  next: NextLink | null;
  alreadyDone?: boolean;
}) {
  const last = latest && typeof latest.input === "object" && latest.input && "instructions" in latest.input ? String((latest.input as { instructions: string }).instructions) : "";
  const [instructions, setInstructions] = useState(last);
  const [attempt, setAttempt] = useState<AttemptView | null>(latest);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const transcript = attempt?.output && "transcript" in attempt.output ? attempt.output.transcript : [];
  const kindOf = (id: string) => messages.find((m) => m.id === id)?.kind;
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
              const r = await submitAgentAction(exerciseId, instructions);
              if (r.ok) setAttempt(r.attempt);
              else setError(r.error);
            });
          }}
        >
          <div>
            <label htmlFor="bot-instructions">Your bot&apos;s instructions</label>
            <textarea
              id="bot-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={PLACEHOLDER}
              style={{ minHeight: 190 }}
              data-testid="agent-instructions"
            />
          </div>
          <div className="form-foot">
            <span className={`small ${instructions.length > 6000 ? "text-bad" : "muted"}`}>{instructions.length.toLocaleString()} of 6,000 characters</span>
            <button className={`btn ${passed ? "" : "btn-primary"}`} disabled={pending || !instructions.trim()} data-testid="agent-submit">
              {pending ? "Testing your bot…" : attempt ? "Test again" : "Test my bot"}
            </button>
          </div>
          {pending && <div className="notice notice-info small">Your bot answers the three messages, then the coach checks each reply. About 15 seconds.</div>}
          {error && <div className="notice notice-fail">{error}</div>}
        </form>
      </section>

      {transcript.length > 0 && (
        <section className="card stack" data-testid="bot-transcript">
          <h2 style={{ margin: 0 }}>How your bot answered</h2>
          {transcript.map((t) => {
            const kind = kindOf(t.id);
            return (
              <div key={t.id} className="chat">
                <div className="bubble bubble-in">
                  <div className="bubble-from">
                    {t.from}
                    {kind && <span className={`tag ${KIND_TAG[kind]}`}>{KIND_LABELS[kind]}</span>}
                  </div>
                  {t.text}
                </div>
                <div className="bubble bubble-out" data-testid={`bot-reply-${t.id}`}>
                  <div className="bubble-from">Your bot</div>
                  {t.reply}
                </div>
              </div>
            );
          })}
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
