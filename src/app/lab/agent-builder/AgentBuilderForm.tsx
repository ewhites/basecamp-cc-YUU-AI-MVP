"use client";

import { useState, useTransition } from "react";
import { submitAgentAction } from "@/app/lab/actions";
import { AttemptResultClient } from "@/components/AttemptResultClient";
import type { AttemptView } from "@/lib/attempts";
import type { CoworkerMessage } from "@/lib/curriculum/types";
import { KIND_LABELS, KIND_TAG } from "./kinds";

const PLACEHOLDER = `Job: what the bot does, for whom, from which source.
Tools/limits: what it must never do or promise.
Stop rule: when it should say "I don't know" instead of guessing.
Handoff: who to send people to, and how to reach them.`;

export function AgentBuilderForm({
  exerciseId,
  latest,
  messages,
}: {
  exerciseId: string;
  latest: (AttemptView & { input?: unknown }) | null;
  messages: CoworkerMessage[];
}) {
  const last = latest && typeof latest.input === "object" && latest.input && "instructions" in latest.input ? String((latest.input as { instructions: string }).instructions) : "";
  const [instructions, setInstructions] = useState(last);
  const [attempt, setAttempt] = useState<AttemptView | null>(latest);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const transcript = attempt?.output && "transcript" in attempt.output ? attempt.output.transcript : [];
  const kindOf = (id: string) => messages.find((m) => m.id === id)?.kind;

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
            <textarea id="bot-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={PLACEHOLDER} style={{ minHeight: 200 }} data-testid="bot-instructions" />
            <div className="small muted" style={{ marginTop: "0.3rem" }}>
              Use the four-part spec (M03-S2): <b>Job</b>, <b>Tools/limits</b>, <b>Stop rule</b>, <b>Handoff</b>.
            </div>
          </div>
          <div className="row between">
            <span className="small muted">{instructions.length.toLocaleString()} / 6,000 characters</span>
            <button className="btn btn-primary" disabled={pending || !instructions.trim()} data-testid="test-bot">
              {pending ? "Testing your bot…" : attempt ? "Test again" : "Test my bot"}
            </button>
          </div>
          {pending && <div className="notice notice-info small">Your bot answers the three coworker messages, then the coach checks how it handled each one. About 15 seconds.</div>}
          {error && <div className="notice notice-fail">{error}</div>}
        </form>
      </section>

      {transcript.length > 0 && (
        <section className="card stack" data-testid="bot-transcript">
          <h2 style={{ margin: 0 }}>Test transcript</h2>
          {transcript.map((t) => {
            const kind = kindOf(t.id);
            return (
              <div key={t.id} className="stack" style={{ borderTop: "1px solid var(--border)", paddingTop: "0.6rem" }}>
                <div className="row" style={{ gap: "0.4rem" }}>
                  <b className="small">{t.from}</b>
                  {kind && <span className={`tag ${KIND_TAG[kind]}`}>{KIND_LABELS[kind]}</span>}
                </div>
                <div style={{ maxWidth: "85%", background: "var(--d2l-color-sylvite)", border: "1px solid var(--border)", borderRadius: "12px 12px 12px 2px", padding: "0.55rem 0.8rem", fontSize: "0.88rem" }}>
                  {t.text}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div
                    style={{ maxWidth: "85%", background: "var(--d2l-color-celestine-plus-2)", border: "1px solid #b8e1fb", borderRadius: "12px 12px 2px 12px", padding: "0.55rem 0.8rem", fontSize: "0.88rem", whiteSpace: "pre-wrap" }}
                    data-testid={`bot-reply-${t.id}`}
                  >
                    <div className="small muted" style={{ fontWeight: 700 }}>
                      Your bot
                    </div>
                    {t.reply}
                  </div>
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
    </>
  );
}
