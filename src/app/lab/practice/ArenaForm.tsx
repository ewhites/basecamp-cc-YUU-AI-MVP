"use client";

import { useState, useTransition } from "react";
import { runArenaAction, submitArenaAction } from "@/app/lab/actions";
import { AttemptResultClient } from "@/components/AttemptResultClient";
import type { AttemptView, StoredOutput } from "@/lib/attempts";
import { ARENA_MODELS, modelLabel } from "@/lib/models";
import { attemptPassed, NextStep, type NextLink } from "./NextStep";

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

/** The three answers side by side, with measured time and estimated cost. */
function Answers({ outputs, picked }: { outputs: ArenaOutputs; picked?: string }) {
  return (
    <div className="grid grid-3" data-testid="arena-outputs">
      {byArenaOrder(outputs).map((o) => {
        const meta = ARENA_MODELS.find((m) => m.id === o.model);
        return (
          <div key={o.model} className={`model-card${picked === o.model ? " picked" : ""}`} data-testid={`arena-output-${o.model}`}>
            <div>
              <h3 style={{ margin: 0 }}>{modelLabel(o.model)}</h3>
              {meta && <div className="tiny muted">{meta.blurb}</div>}
            </div>
            <pre className="model-text">{o.text}</pre>
            <div className="model-meta tiny">
              <span>{(o.latencyMs / 1000).toFixed(1)} s</span>
              <span title="Estimated from list prices">{formatCost(o.costUsd)} est.</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Module 2 practice, as a guided flow: write one prompt, compare three answers, pick one and say why. */
export function ArenaForm({ exerciseId, latest, next, alreadyDone = false }: { exerciseId: string; latest: Latest; next: NextLink | null; alreadyDone?: boolean }) {
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
  // Outputs saved with the latest attempt, shown (collapsed) until the student runs again.
  const savedOutputs = !run && attempt?.output && "outputs" in attempt.output ? attempt.output.outputs : null;

  return (
    <>
      <ol className="steps-inline arena-steps" aria-label="Steps" data-testid="arena-steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i + 1 < step ? "done" : i + 1 === step ? "on" : ""} aria-current={i + 1 === step ? "step" : undefined}>
            {s}
          </li>
        ))}
      </ol>

      <section className="card">
        <form
          className="stack"
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
          <div>
            <label htmlFor="arena-prompt" className="step-title">
              1. Write one prompt
            </label>
            <textarea
              id="arena-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="One prompt for the task. The attached material is added for you."
              data-testid="arena-prompt"
            />
          </div>
          <div className="form-foot">
            <span className="small muted">The same prompt goes to Haiku, Sonnet and Opus.</span>
            <button className={`btn ${run || passed ? "" : "btn-primary"}`} disabled={running || submitting || !prompt.trim()} data-testid="arena-run">
              {running ? "Running on 3 models…" : run ? "Run again" : "Run on 3 models"}
            </button>
          </div>
          {running && <div className="notice notice-info small">Sending your prompt to all three models at once. About 10 to 20 seconds.</div>}
          {error && <div className="notice notice-fail">{error}</div>}
          {distress && (
            <div className="notice notice-warn" style={{ whiteSpace: "pre-wrap" }} data-testid="distress-message">
              {distress}
            </div>
          )}
        </form>
      </section>

      {run && (
        <section className="card stack" aria-labelledby="arena-compare">
          <div>
            <h2 id="arena-compare" style={{ margin: 0 }}>2. Compare three answers</h2>
            <p className="small muted" style={{ margin: "4px 0 0" }}>
              Each model got your prompt word for word. Times are measured; costs are estimates from list prices.
            </p>
          </div>
          {run.piiRemoved && <div className="notice notice-warn small">Personal details were removed before anything was sent to the AI: {run.piiRemoved}.</div>}
          <Answers outputs={run.outputs} picked={picked} />
        </section>
      )}

      {run && (
        <section className="card">
          <form
            className="stack"
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
            <fieldset className="choices">
              <legend>3. Pick one and say why</legend>
              <div className="choice-row">
                {byArenaOrder(run.outputs).map((o) => (
                  <label key={o.model} className={`choice${picked === o.model ? " on" : ""}`}>
                    <input
                      type="radio"
                      name="picked-model"
                      value={o.model}
                      checked={picked === o.model}
                      onChange={() => setPicked(o.model)}
                      data-testid={`arena-pick-${o.model}`}
                    />
                    {modelLabel(o.model)}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="arena-reasoning">{picked ? `Why ${modelLabel(picked)}?` : "Why is your pick the best?"}</label>
              <textarea
                id="arena-reasoning"
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                maxLength={4000}
                placeholder="Fit: … Trust: … Cost: …"
                data-testid="arena-reasoning"
              />
              <ul className="hints">
                {HINTS.map((h) => (
                  <li key={h.label}>
                    <b>{h.label}:</b> {h.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="form-foot">
              <span className="small muted">Trust breaks ties. Cost never outweighs it.</span>
              <button className={`btn ${passed ? "" : "btn-primary"}`} disabled={submitting || running || !picked || !reasoning.trim()} data-testid="arena-submit">
                {submitting ? "Scoring…" : finished ? "Submit again" : "Submit for coaching"}
              </button>
            </div>
            {submitting && <div className="notice notice-info small">The coach is checking your pick and reasoning. About 10 seconds.</div>}
          </form>
        </section>
      )}

      {attempt && (
        <section className="card stack">
          <AttemptResultClient exerciseId={exerciseId} attempt={attempt} />
          {savedOutputs && savedOutputs.length > 0 && (
            <details className="disclosure">
              <summary>The three answers you compared</summary>
              <div className="stack-sm" style={{ marginTop: 12 }}>
                <Answers outputs={savedOutputs} picked={field(latest?.input, "pickedModel")} />
                {field(latest?.input, "reasoning") && (
                  <p className="small" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    <b>Your reasoning:</b> {field(latest?.input, "reasoning")}
                  </p>
                )}
              </div>
            </details>
          )}
        </section>
      )}

      {passed && <NextStep next={next} />}
    </>
  );
}
