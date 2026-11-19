"use client";

import { useState, useTransition } from "react";
import { submitAgentAction } from "@/app/lab/actions";
import { CoachSide } from "@/components/AskCoach";
import { AttemptResult, attemptQuotes } from "@/components/AttemptResult";
import { Button } from "@/design/Button";
import type { AttemptView } from "@/lib/attempts";
import type { CoworkerMessage } from "@/lib/curriculum/types";
import { ErrorLine, Frame, Slab, type TaskHead } from "./Frame";
import { KIND_LABELS } from "./kinds";
import { attemptPassed, NextStep, type NextLink } from "./NextStep";
import { Highlighted, WriteField } from "./WriteField";

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
  head,
}: {
  exerciseId: string;
  latest: Latest;
  messages: CoworkerMessage[];
  next: NextLink | null;
  alreadyDone?: boolean;
  head: TaskHead;
}) {
  const last = latest && typeof latest.input === "object" && latest.input && "instructions" in latest.input ? String((latest.input as { instructions: string }).instructions) : "";
  const [instructions, setInstructions] = useState(last);
  const [attempt, setAttempt] = useState<AttemptView | null>(latest);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const transcript = attempt?.output && "transcript" in attempt.output ? attempt.output.transcript : [];
  const kindOf = (id: string) => messages.find((m) => m.id === id)?.kind;
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
          empty="Test your bot to see what to fix"
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
            const r = await submitAgentAction(exerciseId, instructions);
            if (r.ok) setAttempt(r.attempt);
            else setError(r.error);
          });
        }}
      >
        <Slab
          note={
            pending ? (
              "Your bot answers the three messages, then the coach checks each reply. About 15 seconds"
            ) : (
              <>
                {attempt && <span>Try {attempt.attemptNo + 1}</span>}
                <span className={instructions.length > 6000 ? "ln-over" : undefined}>{instructions.length.toLocaleString()} of 6,000 characters</span>
              </>
            )
          }
          action={
            <Button type="submit" variant={passed ? "paper" : "primary"} disabled={pending || !instructions.trim()} data-testid="agent-submit">
              {pending ? "Testing" : attempt ? "Test bot again" : "Test your bot"}
            </Button>
          }
        >
          <WriteField
            id="bot-instructions"
            label="Your bot's instructions"
            value={instructions}
            onChange={setInstructions}
            quotes={quotes}
            quoteKey={attempt?.id}
            placeholder={PLACEHOLDER}
            rows={8}
            testId="agent-instructions"
          />
        </Slab>
        {error && <ErrorLine>{error}</ErrorLine>}
      </form>

      {transcript.length > 0 && (
        <section className="ln-output" data-testid="bot-transcript" aria-labelledby="bot-answered">
          <h2 id="bot-answered" className="ln-h">
            How your bot answered
          </h2>
          <ol key={attempt?.id} className="ln-convo">
            {transcript.map((t) => {
              const kind = kindOf(t.id);
              return (
                <li key={t.id}>
                  <div className="ln-say">
                    <span className="ln-label">
                      {t.from}
                      {kind && `, ${KIND_LABELS[kind].toLowerCase()} message`}
                    </span>
                    <p>{t.text}</p>
                  </div>
                  <div className="ln-say is-bot" data-testid={`bot-reply-${t.id}`}>
                    <span className="ln-label">Your bot</span>
                    <p>
                      <Highlighted text={t.reply} quotes={quotes} />
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {passed && <NextStep next={next} />}
    </Frame>
  );
}
