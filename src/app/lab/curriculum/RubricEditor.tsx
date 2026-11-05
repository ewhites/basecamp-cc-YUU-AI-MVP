"use client";

import { useState, useTransition } from "react";
import { SKILL_LABELS, type Skill } from "@/lib/curriculum/types";
import { createDraftAction } from "./actions";

export interface EditorExercise {
  id: string;
  title: string;
  checks: { key: string; text: string; skill: string; version: number }[];
}

export function RubricEditor({ exercises }: { exercises: EditorExercise[] }) {
  const [exId, setExId] = useState(exercises[0]?.id ?? "");
  const ex = exercises.find((e) => e.id === exId);
  const [key, setKey] = useState(ex?.checks[0]?.key ?? "");
  const check = ex?.checks.find((c) => c.key === key);
  const [text, setText] = useState(check?.text ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const pickExercise = (id: string) => {
    const next = exercises.find((e) => e.id === id);
    setExId(id);
    setKey(next?.checks[0]?.key ?? "");
    setText(next?.checks[0]?.text ?? "");
    setMsg(null);
  };
  const pickCheck = (k: string) => {
    setKey(k);
    setText(ex?.checks.find((c) => c.key === k)?.text ?? "");
    setMsg(null);
  };

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await createDraftAction(exId, key, text);
          setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
        });
      }}
    >
      <div className="grid grid-2">
        <div>
          <label htmlFor="re-ex">Exercise</label>
          <select id="re-ex" value={exId} onChange={(e) => pickExercise(e.target.value)} data-testid="rubric-exercise">
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="re-check">Check</label>
          <select id="re-check" value={key} onChange={(e) => pickCheck(e.target.value)} data-testid="rubric-check">
            {ex?.checks.map((c) => (
              <option key={c.key} value={c.key}>
                {c.text}
              </option>
            ))}
          </select>
        </div>
      </div>
      {check && (
        <p className="small muted" style={{ margin: 0 }}>
          Skill: {SKILL_LABELS[check.skill as Skill] ?? check.skill} · published version {check.version} · key <code>{check.key}</code>
        </p>
      )}
      <div>
        <label htmlFor="re-text">Check text (a yes/no question)</label>
        <textarea id="re-text" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 80 }} data-testid="rubric-text" />
      </div>
      <div className="row between">
        <span className="small muted">Saving makes a draft. Students keep being graded on the published version until a draft passes the eval and is published.</span>
        <button className="btn btn-primary" disabled={pending || !text.trim() || text.trim() === check?.text} data-testid="rubric-save">
          {pending ? "Saving…" : "Save as draft"}
        </button>
      </div>
      {msg && <div className={`notice ${msg.ok ? "notice-pass" : "notice-fail"}`}>{msg.text}</div>}
    </form>
  );
}
