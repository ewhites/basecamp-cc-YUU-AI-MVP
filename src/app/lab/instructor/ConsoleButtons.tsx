"use client";

import { useState, useTransition } from "react";
import { SimulatedTag } from "@/components/Tags";
import { overrideCheckAction, releaseScoresAction } from "./actions";

/** "Assign mini-lesson": simulated, no database write. */
export function AssignMiniLesson({ title }: { title: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="stack">
      <div className="row">
        <button className="btn btn-primary" onClick={() => setDone(true)} disabled={done} data-testid="assign-mini-lesson">
          Assign mini-lesson
        </button>
        <SimulatedTag what="course calendar" />
      </div>
      {done && (
        <div className="notice notice-pass small" role="status">
          Assigned: &ldquo;{title}&rdquo; added to the next class (simulated).
        </div>
      )}
    </div>
  );
}

/** "Send to gradebook": releases scored attempts in this section (simulated sync). */
export function SendToGradebook({ sectionId }: { sectionId: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="stack">
      <div className="row">
        <button
          className="btn"
          disabled={pending}
          data-testid="send-to-gradebook"
          onClick={() =>
            start(async () => {
              const r = await releaseScoresAction(sectionId);
              setMsg(r.ok ? { ok: true, text: `${r.value} attempts sent (simulated).` } : { ok: false, text: r.error });
            })
          }
        >
          {pending ? "Sending…" : "Send to gradebook"}
        </button>
        <SimulatedTag what="gradebook sync" />
      </div>
      {msg && (
        <div className={`notice small ${msg.ok ? "notice-pass" : "notice-fail"}`} role="status" data-testid="gradebook-result">
          {msg.text}
        </div>
      )}
    </div>
  );
}

/** One check's override form: pass/fail plus a required note. */
export function OverrideForm({ attemptId, checkKey, label, pass }: { attemptId: string; checkKey: string; label: string; pass: boolean }) {
  const [value, setValue] = useState(pass ? "pass" : "fail");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="stack"
      data-testid={`override-${checkKey}`}
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        if (!note.trim()) {
          setMsg({ ok: false, text: "Add a short note saying why." });
          return;
        }
        start(async () => {
          const r = await overrideCheckAction(attemptId, checkKey, value === "pass", note);
          if (r.ok) {
            setNote("");
            setMsg({ ok: true, text: "Saved. The student's score is updated." });
          } else setMsg({ ok: false, text: r.error });
        });
      }}
    >
      <div className="small">
        <b>{label}</b>
      </div>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ width: "7rem" }}>
          <label htmlFor={`ov-${checkKey}`}>Score</label>
          <select id={`ov-${checkKey}`} value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: "12rem" }}>
          <label htmlFor={`note-${checkKey}`}>Note (required)</label>
          <input id={`note-${checkKey}`} type="text" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Why you changed it" />
        </div>
        <button className="btn" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {msg && <div className={`notice small ${msg.ok ? "notice-pass" : "notice-fail"}`} role="status">{msg.text}</div>}
    </form>
  );
}
