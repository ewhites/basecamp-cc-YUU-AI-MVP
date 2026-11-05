"use client";

import { useState, useTransition } from "react";
import { runArenaAction, submitArenaAction } from "@/app/lab/actions";
import { AttemptResultClient } from "@/components/AttemptResultClient";
import type { AttemptView, StoredOutput } from "@/lib/attempts";
import { ARENA_MODELS, modelLabel } from "@/lib/models";

type ArenaOutputs = Extract<StoredOutput, { outputs: unknown }>["outputs"];
type RunResult = Awaited<ReturnType<typeof runArenaAction>>;
type RunOk = Extract<RunResult, { outputs: unknown }>;

function field(input: unknown, key: string): string {
  return typeof input === "object" && input && key in input ? String((input as Record<string, unknown>)[key] ?? "") : "";
}

function OutputsGrid({ outputs, picked, onPick }: { outputs: ArenaOutputs; picked?: string; onPick?: (model: string) => void }) {
  const ordered = [...outputs].sort((a, b) => ARENA_MODELS.findIndex((m) => m.id === a.model) - ARENA_MODELS.findIndex((m) => m.id === b.model));
  return (
    <div className="grid grid-3" data-testid="arena-outputs">
      {ordered.map((o) => {
        const meta = ARENA_MODELS.find((m) => m.id === o.model);
        const chosen = picked === o.model;
        return (
          <div key={o.model} className="card" style={chosen ? { borderColor: "var(--primary)", outline: "2px solid var(--d2l-color-celestine-plus-1)" } : undefined} data-testid={`arena-output-${o.model}`}>
            <h3 style={{ margin: 0 }}>{modelLabel(o.model)}</h3>
            {meta && <div className="small muted">{meta.blurb}</div>}
            <pre style={{ margin: "0.5rem 0" }}>{o.text}</pre>
            <div className="row between small">
              <span>{(o.latencyMs / 1000).toFixed(1)} s</span>
              <span title="Estimate from list prices">~${o.costUsd.toFixed(5)} est.</span>
            </div>
            {onPick && (
              <label className="row" style={{ marginTop: "0.5rem", fontWeight: 700, cursor: "pointer" }}>
                <input type="radio" name="picked-model" value={o.model} checked={chosen} onChange={() => onPick(o.model)} data-testid={`pick-${o.model}`} />
                Pick this one
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ModelArenaForm({ exerciseId, latest }: { exerciseId: string; latest: (AttemptView & { input?: unknown }) | null }) {
  const [prompt, setPrompt] = useState(field(latest?.input, "prompt"));
  const [run, setRun] = useState<RunOk | null>(null);
  const [picked, setPicked] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [attempt, setAttempt] = useState<AttemptView | null>(latest);
  const [error, setError] = useState<string | null>(null);
  const [distress, setDistress] = useState<string | null>(null);
  const [running, startRun] = useTransition();
  const [submitting, startSubmit] = useTransition();

  // Outputs saved with the latest attempt, shown read-only until the student runs again.
  const savedOutputs = !run && attempt?.output && "outputs" in attempt.output ? attempt.output.outputs : null;
  const savedPick = field(latest?.input, "pickedModel");
  const savedReasoning = field(latest?.input, "reasoning");

  return (
    <>
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
            <label htmlFor="arena-prompt">Your prompt (one prompt, sent to all three models)</label>
            <textarea id="arena-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Write one prompt. The attached material is added automatically." data-testid="arena-prompt" />
          </div>
          <div className="row between">
            <span className="small muted">Runs on {ARENA_MODELS.map((m) => m.label).join(", ")}</span>
            <button className="btn btn-primary" disabled={running || submitting || !prompt.trim()} data-testid="run-arena">
              {running ? "Running on 3 models…" : run || savedOutputs ? "Run again on 3 models" : "Run on 3 models"}
            </button>
          </div>
          {running && <div className="notice notice-info small">Sending the same prompt to Haiku, Sonnet and Opus at the same time. About 10 to 20 seconds.</div>}
          {error && <div className="notice notice-fail">{error}</div>}
          {distress && (
            <div className="notice notice-warn" style={{ whiteSpace: "pre-wrap" }} data-testid="distress-message">
              {distress}
            </div>
          )}
        </form>
      </section>

      {run && (
        <section className="card stack">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Three models, one prompt</h2>
            <span className="tag tag-info">Byte-identical prompt (M02-S3)</span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            All three models got exactly the same prompt and material, byte for byte, so the only thing that changed is the model. Cost is an estimate from list prices.
          </p>
          {run.piiRemoved && <div className="notice notice-warn small">Personal details were removed before anything was sent to the AI: {run.piiRemoved}.</div>}
          <OutputsGrid outputs={run.outputs} picked={picked} onPick={setPicked} />
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startSubmit(async () => {
                const r = await submitArenaAction(exerciseId, { prompt: run.prompt, pickedModel: picked, reasoning, outputs: run.outputs, token: run.token });
                if (r.ok) setAttempt(r.attempt);
                else setError(r.error);
              });
            }}
          >
            <div>
              <label htmlFor="arena-reasoning">Why is {picked ? modelLabel(picked) : "your pick"} the best? Use Fit, Trust and Cost.</label>
              <textarea
                id="arena-reasoning"
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                maxLength={4000}
                placeholder={"Fit: …\nTrust: …\nCost: …"}
                data-testid="arena-reasoning"
              />
            </div>
            <div className="row between">
              <span className="small muted">{picked ? `Picked: ${modelLabel(picked)}` : "Pick one of the three outputs above."}</span>
              <button className="btn btn-primary" disabled={submitting || running || !picked || !reasoning.trim()} data-testid="submit-arena">
                {submitting ? "Scoring…" : "Submit for coaching"}
              </button>
            </div>
            {submitting && <div className="notice notice-info small">The coach is checking your pick and reasoning against the rubric. About 10 seconds.</div>}
          </form>
        </section>
      )}

      {savedOutputs && savedOutputs.length > 0 && (
        <section className="card stack">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Your last comparison</h2>
            <span className="tag tag-info">Byte-identical prompt (M02-S3)</span>
          </div>
          <OutputsGrid outputs={savedOutputs} picked={savedPick} />
          {savedReasoning && (
            <div className="small">
              <b>Your pick: {savedPick ? modelLabel(savedPick) : "–"}.</b> <span style={{ whiteSpace: "pre-wrap" }}>{savedReasoning}</span>
            </div>
          )}
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
