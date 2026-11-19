"use client";

import { useState, useTransition } from "react";
import { submitAgentAction } from "@/app/lab/actions";
import { CoachSide } from "@/components/AskCoach";
import { AttemptResult, attemptQuotes } from "@/components/AttemptResult";
import { ToolPanels, type DraftStatus } from "@/components/ToolPanels";
import { Button } from "@/design/Button";
import { Checkbox } from "@/design/Checkbox";
import { Panel, Section } from "@/design/Structure";
import type { AttemptView } from "@/lib/attempts";
import type { CoworkerMessage } from "@/lib/curriculum/types";
import {
  cleanTools,
  SANDBOX_EXERCISE,
  TOOL_BLURBS,
  TOOL_IDS,
  TOOL_LABELS,
  type SandboxResult,
  type ToolId,
} from "@/lib/sandbox/tools";
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
  const last =
    latest &&
    typeof latest.input === "object" &&
    latest.input &&
    "instructions" in latest.input
      ? String((latest.input as { instructions: string }).instructions)
      : "";
  const sandbox = exerciseId === SANDBOX_EXERCISE;
  const lastTools =
    latest &&
    typeof latest.input === "object" &&
    latest.input &&
    "tools" in latest.input
      ? cleanTools((latest.input as { tools: unknown }).tools)
      : [];
  const [instructions, setInstructions] = useState(last);
  const [tools, setTools] = useState<ToolId[]>(lastTools);
  const [attempt, setAttempt] = useState<AttemptView | null>(latest);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const transcript =
    attempt?.output && "transcript" in attempt.output
      ? attempt.output.transcript
      : [];
  const used =
    attempt?.output && "sandbox" in attempt.output
      ? attempt.output.sandbox
      : undefined;
  const kindOf = (id: string) => messages.find((m) => m.id === id)?.kind;
  const passed = alreadyDone || attemptPassed(attempt);
  const quotes = attemptQuotes(attempt);

  const picker = sandbox ? (
    <Section
      title="Pick the bot's tools"
      id="tools"
      desc="Fewer tools means fewer ways for the bot to go wrong"
      className="sb-picker"
      data-testid="tool-picker"
    >
      <Panel list role="group" aria-labelledby="tools-h" className="sb-picks">
        {TOOL_IDS.map((id) => (
          <Checkbox
            key={id}
            checked={tools.includes(id)}
            onChange={(on) =>
              setTools((t) =>
                cleanTools(on ? [...t, id] : t.filter((x) => x !== id)),
              )
            }
            data-testid={`tool-pick-${id}`}
          >
            <span className="sb-pick">
              <span className="sb-pick-name">{TOOL_LABELS[id]}</span>
              <span className="sb-pick-note">{TOOL_BLURBS[id]}</span>
            </span>
            <span className="sb-sim">Simulated</span>
          </Checkbox>
        ))}
      </Panel>
    </Section>
  ) : undefined;

  return (
    <Frame
      head={head}
      beside={picker}
      after={
        transcript.length > 0 || used || passed ? (
          <>
            {transcript.length > 0 && (
              <Section
                title="How your bot answered"
                id="bot-answered"
                data-testid="bot-transcript"
              >
                <Panel>
                  <ol key={attempt?.id} className="ln-convo">
                    {transcript.map((t) => {
                      const kind = kindOf(t.id);
                      return (
                        <li key={t.id}>
                          <div className="ln-say">
                            <span className="ln-label">
                              {t.from}
                              {kind &&
                                `, ${KIND_LABELS[kind].toLowerCase()} message`}
                            </span>
                            <p>{t.text}</p>
                          </div>
                          <div
                            className="ln-say is-bot"
                            data-testid={`bot-reply-${t.id}`}
                          >
                            <span className="ln-label">Your bot</span>
                            <p>
                              <Highlighted text={t.reply} quotes={quotes} />
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Panel>
              </Section>
            )}

            {used && (
              <UsedTools key={attempt?.id} used={used} messages={messages} />
            )}

            {passed && <NextStep next={next} />}
          </>
        ) : undefined
      }
      coach={
        <CoachSide
          className="ds-rise ln-i2"
          exerciseId={exerciseId}
          module={head.module}
          result={
            attempt ? (
              <AttemptResult exerciseId={exerciseId} attempt={attempt} />
            ) : undefined
          }
          empty="Test your bot to see what to fix"
          earlier={head.earlier}
          next={next}
          arriveKey={attempt?.id}
        />
      }
    >
      <Section title="Your bot's instructions" id="work">
        <form
          className="ln-work"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await submitAgentAction(
                exerciseId,
                instructions,
                sandbox ? tools : undefined,
              );
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
                  <span
                    className={
                      instructions.length > 6000 ? "ln-over" : undefined
                    }
                  >
                    {instructions.length.toLocaleString()} of 6,000 characters
                  </span>
                </>
              )
            }
            action={
              <Button
                type="submit"
                variant={passed ? "secondary" : "primary"}
                disabled={pending || !instructions.trim()}
                data-testid="agent-submit"
              >
                {pending
                  ? "Testing"
                  : attempt
                    ? "Test bot again"
                    : "Test your bot"}
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
      </Section>
    </Frame>
  );
}

/** After a run: the four panels with what the bot left in each. Approve and Send back are client state only. */
function UsedTools({
  used,
  messages,
}: {
  used: SandboxResult;
  messages: CoworkerMessage[];
}) {
  const [status, setStatus] = useState<Record<string, DraftStatus>>({});
  const label = (id: string) => {
    const m = messages.find((x) => x.id === id);
    return m ? `${KIND_LABELS[m.kind]} message` : undefined;
  };
  const sheet = used.sheet;
  const looked = sheet?.lookups.length ?? 0;
  return (
    <Section
      title="What your bot used"
      id="used"
      data-testid="sandbox-result"
      desc="Nothing is sent. Approve and Send back only show what a person would decide"
    >
      <ToolPanels
        granted={used.tools}
        who="your bot"
        sheet={
          sheet
            ? {
                name: sheet.sheet.name,
                columns: sheet.sheet.columns,
                rows: sheet.sheet.rows,
                read: looked > 0,
                note: `Your bot searched the sheet ${looked} ${looked === 1 ? "time" : "times"}`,
                idle: "Your bot did not open the sheet",
              }
            : null
        }
        notes={used.notes.map((n) => ({
          text: n.text,
          label: label(n.messageId),
        }))}
        memory={used.memory.map((n) => ({
          text: n.text,
          label: label(n.messageId),
        }))}
        drafts={used.outbox.map((d) => ({
          ...d,
          label: label(d.messageId),
          status: status[d.id] ?? "waiting",
        }))}
        onDecide={(id, decision) =>
          setStatus((s) => ({
            ...s,
            [id]: decision === "approve" ? "sent" : "sent_back",
          }))
        }
      />
    </Section>
  );
}
