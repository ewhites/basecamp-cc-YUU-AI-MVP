"use client";

import { useState, useTransition } from "react";
import { publishDraftAction, runDraftEvalAction, type DraftEvalResult } from "./actions";

export interface DraftItem {
  id: number;
  exerciseTitle: string;
  key: string;
  version: number;
  text: string;
  status: string;
  createdAt: string;
  publishedText: string | null;
  latestEval: { passedGate: boolean; summary: Record<string, unknown>; createdAt: string } | null;
  canPublish: boolean;
}

function rate(x: unknown): string | null {
  const n = typeof x === "string" ? Number(x) : x;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return `${Math.round((n > 1 ? n / 100 : n) * 100)}%`;
}

function EvalLine({ passedGate, summary, at }: { passedGate: boolean; summary: Record<string, unknown>; at?: string }) {
  const held = rate(summary.heldOutAgreement) ?? rate(summary.agreement);
  return (
    <span className="row small">
      <span className={`tag ${passedGate ? "tag-pass" : "tag-fail"}`}>{passedGate ? "Eval passed" : "Eval failed"}</span>
      {held && <span>{held} agreement on the held-out set (gate: 80%)</span>}
      {at && <span className="muted">{new Date(at).toLocaleString()}</span>}
    </span>
  );
}

const STATUS_TAG: Record<string, string> = { draft: "tag-info", published: "tag-pass", retired: "tag-warn" };

function Draft({ d }: { d: DraftItem }) {
  const [evalResult, setEvalResult] = useState<DraftEvalResult | null>(null);
  const [publishMsg, setPublishMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [running, startRun] = useTransition();
  const [publishing, startPublish] = useTransition();
  const isDraft = d.status === "draft";

  return (
    <li className="card card-muted" data-testid={`draft-${d.id}`}>
      <div className="row between">
        <div className="row">
          <strong>{d.exerciseTitle}</strong>
          <code className="small">{d.key}</code>
          <span className="small muted">v{d.version}</span>
          <span className={`tag ${STATUS_TAG[d.status] ?? "tag-info"}`}>{d.status}</span>
        </div>
        <span className="small muted">{new Date(d.createdAt).toLocaleString()}</span>
      </div>
      <p style={{ margin: "0.5rem 0" }}>{d.text}</p>
      {d.publishedText && <p className="small muted">Published now: {d.publishedText}</p>}
      {d.latestEval && <EvalLine passedGate={d.latestEval.passedGate} summary={d.latestEval.summary} at={d.latestEval.createdAt} />}
      {isDraft && (
        <div className="row" style={{ marginTop: "0.6rem" }}>
          <button
            className="btn"
            disabled={running || publishing}
            onClick={() => {
              setEvalResult(null);
              startRun(async () => setEvalResult(await runDraftEvalAction(d.id)));
            }}
            data-testid={`draft-eval-${d.id}`}
          >
            {running ? "Running eval…" : "Run eval on this draft"}
          </button>
          <button
            className="btn btn-primary"
            disabled={!d.canPublish || running || publishing}
            title={d.canPublish ? "Publish this version" : "Publish unlocks after an eval run on this draft passes the gate"}
            onClick={() => {
              setPublishMsg(null);
              startPublish(async () => {
                const r = await publishDraftAction(d.id);
                setPublishMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
              });
            }}
            data-testid={`draft-publish-${d.id}`}
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
          {!d.canPublish && <span className="small muted">Publish unlocks once an eval on this draft passes the gate.</span>}
        </div>
      )}
      {running && <div className="notice notice-info small" style={{ marginTop: "0.5rem" }}>Grading the held-out cases with this draft. This can take a minute or two.</div>}
      {evalResult && !evalResult.ok && <div className="notice notice-fail" style={{ marginTop: "0.5rem" }}>{evalResult.error}</div>}
      {evalResult?.ok && evalResult.error && <div className="notice notice-fail" style={{ marginTop: "0.5rem" }}>{evalResult.error}</div>}
      {evalResult?.ok && !evalResult.error && (
        <div className={`notice ${evalResult.passedGate ? "notice-pass" : "notice-warn"}`} style={{ marginTop: "0.5rem" }}>
          <EvalLine passedGate={evalResult.passedGate} summary={evalResult.summary} />
          <div className="small" style={{ marginTop: "0.3rem" }}>
            {evalResult.passedGate ? "This draft can now be published." : "Not good enough to publish yet. Reword the check and save a new draft."}
          </div>
        </div>
      )}
      {publishMsg && <div className={`notice ${publishMsg.ok ? "notice-pass" : "notice-fail"}`} style={{ marginTop: "0.5rem" }}>{publishMsg.text}</div>}
    </li>
  );
}

export function DraftList({ drafts }: { drafts: DraftItem[] }) {
  if (!drafts.length) return <p className="muted">No drafts yet. Edit a check above to make one.</p>;
  return (
    <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {drafts.map((d) => (
        <Draft key={d.id} d={d} />
      ))}
    </ul>
  );
}
