"use client";

import { useState, useTransition } from "react";
import { runArenaAction, submitArenaAction } from "@/app/lab/actions";
import { CoachSide } from "@/components/AskCoach";
import { AttemptResult, attemptQuotes } from "@/components/AttemptResult";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { AnswerList } from "@/design/AnswerList";
import { Fold, Section } from "@/design/Structure";
import type { AttemptView, StoredOutput } from "@/lib/attempts";
import { ARENA_MODELS, modelLabel } from "@/lib/models";
import { ErrorLine, Frame, Slab, type TaskHead } from "./Frame";
import { attemptPassed, NextStep, type NextLink } from "./NextStep";
import { WriteField } from "./WriteField";

type ArenaOutputs = Extract<StoredOutput, { outputs: unknown }>["outputs"];
type RunResult = Awaited<ReturnType<typeof runArenaAction>>;
type RunOk = Extract<RunResult, { outputs: unknown }>;
type Latest = (AttemptView & { input?: unknown }) | null;

const STEPS = ["Write one prompt", "Compare three answers", "Pick one and say why"];

const HINTS = [
  { label: "Fit", text: "Did it do the job you asked, in the format you asked?" },
  { label: "Trust", text: "Anything wrong or made up? Name it." },
  { label: "Cost", text: "Is the price and wait worth it at this volume?" },
];

function field(input: unknown, key: string): string {
  return typeof input === "object" && input && key in input ? String((input as Record<string, unknown>)[key] ?? "") : "";
}

function byArenaOrder(outputs: ArenaOutputs): ArenaOutputs {
  const rank = (m: string) => ARENA_MODELS.findIndex((x) => x.id === m);
  return [...outputs].sort((a, b) => rank(a.model) - rank(b.model));
}

function formatCost(usd: number): string {
  return usd < 0.001 ? `$${usd.toFixed(5)}` : `$${usd.toFixed(4)}`;
}

/** The three answers side by side (columns on wide screens, stacked on phones), with measured time and estimated cost. */
function Answers({ outputs, picked }: { outputs: ArenaOutputs; picked?: string }) {
  return (
    <div className="ln-answers" data-testid="arena-outputs">
      {byArenaOrder(outputs).map((o) => {
        const meta = ARENA_MODELS.find((m) => m.id === o.model);
        return (
          <section key={o.model} className={`ln-answer ds-sq${picked === o.model ? " is-picked" : ""}`} data-testid={`arena-output-${o.model}`} aria-label={modelLabel(o.model)}>
            <div className="ln-answer-head">
              <h3>{modelLabel(o.model)}</h3>
              {picked === o.model && (
                <span className="ds-status">
                  <Icon name="check" />
                  Your pick
                </span>
              )}
            </div>
            {meta && <p className="ln-answer-blurb">{meta.blurb}</p>}
            <div className="ln-answer-text">{o.text}</div>
            <p className="ln-answer-meta ds-num">
              <span>{(o.latencyMs / 1000).toFixed(1)} s</span>
              <span title="Estimated from list prices">{formatCost(o.costUsd)} est.</span>
            </p>
          </section>
        );
      })}
    </div>
  );
}

/** Module 2 practice, as a guided flow: write one prompt, compare three answers, pick one and say why. */
export function ArenaForm({
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
  const [prompt, setPrompt] = useState(field(latest?.input, "prompt"));
  const [run, setRun] = useState<RunOk | null>(null);
  const [picked, setPicked] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [attempt, setAttempt] = useState<AttemptView | null>(latest);
  const [submittedRun, setSubmittedRun] = useState<RunOk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [distress, setDistress] = useState<string | null>(null);
  const [running, startRun] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const passed = alreadyDone || attemptPassed(attempt);
  const finished = !!run && submittedRun === run;
  const step = finished ? 4 : !run ? 1 : !picked ? 2 : 3;
  // Outputs saved with the latest attempt, shown (folded) until the student runs again.
  const savedOutputs = !run && attempt?.output && "outputs" in attempt.output ? attempt.output.outputs : null;
  const quotes = attemptQuotes(attempt);
  // One main button: Run until there is a run, then Submit, then Continue once passed.
  const runMain = !run && !passed;
  const submitMain = !!run && !passed;

  return (
    <Frame
      head={head}
      coach={
        <CoachSide
          className="ds-rise ln-i2"
          exerciseId={exerciseId}
          module={head.module}
          result={attempt ? <AttemptResult exerciseId={exerciseId} attempt={attempt} /> : undefined}
          empty="Pick a model and say why to see what to fix"
          earlier={head.earlier}
          next={next}
          arriveKey={attempt?.id}
        />
      }
    >
      <ol className="ln-steps" aria-label="Steps" data-testid="arena-steps">
        {STEPS.map((s, i) => (
          <li key={s} data-state={i + 1 < step ? "done" : i + 1 === step ? "on" : "off"} aria-current={i + 1 === step ? "step" : undefined}>
            {i + 1 < step ? <Icon name="check" /> : <span className="ln-step-n ds-num">{i + 1}</span>}
            {s}
          </li>
        ))}
      </ol>

      <Section title="1. Write one prompt" id="arena-write">
      <form
        className="ln-work"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setDistress(null);
          startRun(async () => {
            const r = await runArenaAction(exerciseId, prompt);
            if ("distress" in r) {
              setRun(null);
              setDistress(r.message ?? null);
            } else if ("error" in r) {
              setError(r.error ?? "Something went wrong.");
            } else {
              setRun(r);
              setPicked("");
              setReasoning("");
            }
          });
        }}
      >
        <Slab
          note={running ? "Sending your prompt to all three models. About 10 to 20 seconds" : "The same prompt goes to Haiku, Sonnet and Opus"}
          action={
            <Button type="submit" variant={runMain ? "primary" : "secondary"} disabled={running || submitting || !prompt.trim()} data-testid="arena-run">
              {running ? "Running" : run ? "Run prompt again" : "Run on 3 models"}
            </Button>
          }
        >
          <WriteField
            id="arena-prompt"
            label="Your prompt for all three models"
            value={prompt}
            onChange={setPrompt}
            quotes={quotes}
            quoteKey={attempt?.id}
            placeholder="One prompt for the task. The attached material is added for you."
            rows={4}
            testId="arena-prompt"
          />
        </Slab>
        {error && <ErrorLine>{error}</ErrorLine>}
        {distress && (
          <p className="ln-notice ln-pre" data-testid="distress-message">
            {distress}
          </p>
        )}
      </form>
      </Section>

      {run && (
        <Section title="2. Compare three answers" id="arena-compare" desc="Each model got your prompt word for word. Time is measured, cost is estimated">
          {run.piiRemoved && <p className="ln-notice">Personal details were removed before anything was sent to the AI: {run.piiRemoved}.</p>}
          <Answers outputs={run.outputs} picked={picked} />
        </Section>
      )}

      {run && (
        <Section title="3. Pick one and say why" id="arena-pick">
        <form
          className="ln-work"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const thisRun = run;
            startSubmit(async () => {
              const r = await submitArenaAction(exerciseId, { prompt: thisRun.prompt, pickedModel: picked, reasoning, outputs: thisRun.outputs, token: thisRun.token });
              if (r.ok) {
                setAttempt(r.attempt);
                setSubmittedRun(thisRun);
              } else setError(r.error);
            });
          }}
        >
          <AnswerList
            label="Your pick"
            className="ln-pick"
            value={picked || null}
            onChange={setPicked}
            options={byArenaOrder(run.outputs).map((o) => ({
              value: o.model,
              label: <span data-testid={`arena-pick-${o.model}`}>{modelLabel(o.model)}</span>,
            }))}
          />
          <Slab
            note={submitting ? "The coach is checking your pick and reasoning. About 10 seconds" : "Trust breaks ties. Cost never outweighs it"}
            action={
              <Button type="submit" variant={submitMain ? "primary" : "secondary"} disabled={submitting || running || !picked || !reasoning.trim()} data-testid="arena-submit">
                {submitting ? "Checking" : finished ? "Submit pick again" : "Submit your pick"}
              </Button>
            }
          >
            <WriteField
              id="arena-reasoning"
              label={picked ? `Why ${modelLabel(picked)}` : "Why your pick is the best"}
              value={reasoning}
              onChange={setReasoning}
              quotes={quotes}
              quoteKey={attempt?.id}
              maxLength={4000}
              placeholder={picked ? `Why ${modelLabel(picked)}? Fit: … Trust: … Cost: …` : "Fit: … Trust: … Cost: …"}
              testId="arena-reasoning"
            />
          </Slab>
          <Fold label="What to look at: Fit, Trust, Cost">
            <ul className="ln-hints">
              {HINTS.map((h) => (
                <li key={h.label}>
                  <b>{h.label}</b>
                  <span>{h.text}</span>
                </li>
              ))}
            </ul>
          </Fold>
        </form>
        </Section>
      )}

      {savedOutputs && savedOutputs.length > 0 && (
        <Fold label="The three answers you compared" className="ln-saved">
          <Answers outputs={savedOutputs} picked={field(latest?.input, "pickedModel")} />
          {field(latest?.input, "reasoning") && (
            <div className="ln-reasoning">
              <h3>Your reasoning</h3>
              <p className="ln-read">{field(latest?.input, "reasoning")}</p>
            </div>
          )}
        </Fold>
      )}

      {passed && <NextStep next={next} />}
    </Frame>
  );
}
