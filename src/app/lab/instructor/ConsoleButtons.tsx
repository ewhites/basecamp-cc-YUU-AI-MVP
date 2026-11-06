"use client";

import { useState, useTransition } from "react";
import { SimulatedTag } from "@/components/Tags";
import { overrideCheckAction, releaseScoresAction, resolveFlagAction } from "./actions";

/** "Assign mini-lesson": simulated, no database write. */
export function AssignMiniLesson({ title, primary = false }: { title: string; primary?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="stack-sm">
      <div className="row">
        <button className={`btn ${primary ? "btn-primary" : ""}`} onClick={() => setDone(true)} disabled={done} data-testid="assign-mini-lesson">
          {done ? "Added to next class" : "Add to next class"}
        </button>
        <SimulatedTag what="course calendar" />
      </div>
      {done && (
        <div className="notice notice-pass small" role="status">
          &ldquo;{title}&rdquo; is on the plan for your next class. Simulated: nothing was written to the course calendar.
        </div>
      )}
    </div>
  );
}

/** "Send to gradebook": releases scored attempts in this section (simulated sync). */
export function SendToGradebook({ sectionId, disabled = false }: { sectionId: string; disabled?: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="stack-sm">
      <div className="row">
        <button
          className="btn"
          disabled={pending || disabled}
          data-testid="send-to-gradebook"
          onClick={() =>
            start(async () => {
              const r = await releaseScoresAction(sectionId);
              setMsg(
                r.ok
                  ? { ok: true, text: `${r.value} ${r.value === 1 ? "score" : "scores"} sent. Simulated: no real gradebook was changed.` }
                  : { ok: false, text: r.error },
              );
            })
          }
        >
          {pending ? "Sending\u2026" : "Send to gradebook"}
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
            setMsg({ ok: true, text: "Saved with your note." });
          } else setMsg({ ok: false, text: r.error });
        });
      }}
    >
      <div className="small">
        <b>{label.replace(/\?$/, "")}</b> <span className="muted">Now: {pass ? "pass" : "fail"}</span>
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
          {pending ? "Saving\u2026" : "Save"}
        </button>
      </div>
      {msg && <div className={`notice small ${msg.ok ? "notice-pass" : "notice-fail"}`} role="status">{msg.text}</div>}
    </form>
  );
}

/** Close a flag after following up. The note is required and goes to the audit log. */
export function ResolveFlagForm({ flagId, label, placeholder }: { flagId: number; label: string; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (msg?.ok) {
    return (
      <div className="notice notice-pass small" role="status" data-testid="flag-resolved">
        {msg.text}
      </div>
    );
  }
  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)} data-testid={`resolve-flag-${flagId}`}>
        {label}
      </button>
    );
  }
  return (
    <form
      className="stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        if (!note.trim()) {
          setMsg({ ok: false, text: "Add a short note first." });
          return;
        }
        start(async () => {
          const r = await resolveFlagAction(flagId, note);
          setMsg(r.ok ? { ok: true, text: "Done. It's off your list, and your note is saved." } : { ok: false, text: r.error });
        });
      }}
    >
      <label htmlFor={`flag-note-${flagId}`}>Note (required, only staff see it)</label>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <input
          id={`flag-note-${flagId}`}
          type="text"
          value={note}
          maxLength={500}
          autoFocus
          onChange={(e) => setNote(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: "12rem" }}
        />
        <button className="btn btn-primary" disabled={pending} data-testid="resolve-flag-save">
          {pending ? "Saving\u2026" : "Save"}
        </button>
        <button type="button" className="btn btn-subtle" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {msg && <div className="notice small notice-fail" role="status">{msg.text}</div>}
    </form>
  );
}
