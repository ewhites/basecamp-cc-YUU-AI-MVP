"use client";

import { useState, useTransition } from "react";
import { StatusTag } from "@/components/Tags";
import { viewStudentWorkAction, type BreakGlassResult } from "./actions";

const LABELS: Record<string, string> = {
  prompt: "Prompt",
  reasoning: "Reasoning",
  pickedModel: "Picked model",
  instructions: "Bot instructions",
};

function InputView({ input }: { input: Record<string, unknown> }) {
  const fields = Object.entries(input ?? {}).filter(([k, v]) => k !== "studio" && typeof v === "string" && v);
  if (!fields.length) return <pre>{JSON.stringify(input, null, 2)}</pre>;
  return (
    <div className="stack">
      {fields.map(([k, v]) => (
        <div key={k}>
          <div className="small muted">{LABELS[k] ?? k}</div>
          <pre>{String(v)}</pre>
        </div>
      ))}
    </div>
  );
}

export function BreakGlass({ titles }: { titles: Record<string, string> }) {
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<BreakGlassResult | null>(null);
  const [pending, start] = useTransition();
  const reasonOk = reason.trim().length >= 10;

  return (
    <div className="stack">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setResult(await viewStudentWorkAction(studentId, reason)));
        }}
      >
        <div className="grid grid-2">
          <div>
            <label htmlFor="bg-student">Student ID</label>
            <input id="bg-student" type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="S-B-007" autoComplete="off" data-testid="breakglass-student" />
          </div>
          <div>
            <label htmlFor="bg-reason">Reason (at least 10 characters)</label>
            <input id="bg-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why you need to see this work" autoComplete="off" data-testid="breakglass-reason" />
          </div>
        </div>
        <div className="row between">
          <span className="small muted">Every view is written to the audit log with your name and reason.</span>
          <button className="btn btn-primary" disabled={pending || !studentId.trim() || !reasonOk} data-testid="breakglass-submit">
            {pending ? "Opening…" : "View student work"}
          </button>
        </div>
      </form>
      {result && !result.ok && <div className="notice notice-fail">{result.error}</div>}
      {result?.ok && (
        <div className="stack" data-testid="breakglass-result">
          <div className="notice notice-warn">
            This view was logged. Showing {result.rows.length} attempt{result.rows.length === 1 ? "" : "s"} for {result.studentId}.
          </div>
          {result.rows.length === 0 && <p className="muted">No attempts found for that student ID.</p>}
          {result.rows.map((r) => (
            <details key={r.attempt_id} className="card card-muted">
              <summary style={{ cursor: "pointer" }}>
                <span className="row" style={{ display: "inline-flex" }}>
                  <strong>{titles[r.exercise_id] ?? r.exercise_id}</strong>
                  <span>attempt {r.attempt_no}</span>
                  <StatusTag status={r.status} />
                  <span className="small muted">
                    {r.passed ?? "–"}/{r.total ?? "–"} checks · {new Date(r.created_at).toLocaleString()}
                  </span>
                </span>
              </summary>
              <div style={{ marginTop: "0.6rem" }}>
                <InputView input={r.input} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
