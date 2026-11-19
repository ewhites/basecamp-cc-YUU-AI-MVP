"use client";

import { useState, useTransition } from "react";
import { SimulatedTag } from "@/components/Tags";
import { Icon } from "@/design/icons";
import { overrideCheckAction, releaseScoresAction, resolveFlagAction, setDailyCapAction } from "./actions";

/** The outlined second button on the cream sheet. The one orange button on a screen is the main step. */
const LINE = "ds-btn ds-sq st-btn-line";
const MAIN = "ds-btn ds-sq ds-btn-primary";

/** One line of feedback after an action: plain text with an icon, never a coloured box alone. */
function Said({ ok, children, testid }: { ok: boolean; children: React.ReactNode; testid?: string }) {
  return (
    <p className="st-said" data-ok={ok ? "yes" : "no"} role="status" data-testid={testid}>
      <Icon name={ok ? "check" : "minus"} />
      <span>{children}</span>
    </p>
  );
}

/** "Add to next class": simulated, no database write. */
export function AssignMiniLesson({ title, primary = false }: { title: string; primary?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="st-act">
      <div className="st-act-row">
        <button type="button" className={primary ? MAIN : LINE} onClick={() => setDone(true)} disabled={done} data-testid="assign-mini-lesson">
          {done ? "Added to next class" : "Add to next class"}
        </button>
        <SimulatedTag what="course calendar" />
      </div>
      {done && <Said ok>&ldquo;{title}&rdquo; is on the plan for your next class. Nothing was written to a real calendar.</Said>}
    </div>
  );
}

/**
 * "Release scores": scores reach students only after the facilitator releases them (releaseScoresAction).
 * The gradebook test hooks stay on this control so older scripts still find it.
 */
export function ReleaseScores({ sectionId, disabled = false }: { sectionId: string; disabled?: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="st-act">
      <div className="st-act-row">
        <button
          type="button"
          className={LINE}
          disabled={pending || disabled}
          data-testid="send-to-gradebook"
          onClick={() =>
            start(async () => {
              const r = await releaseScoresAction(sectionId);
              setMsg(r.ok ? { ok: true, text: `${r.value} ${r.value === 1 ? "score" : "scores"} released. Students can see them now.` } : { ok: false, text: r.error });
            })
          }
        >
          {pending ? "Releasing…" : "Release scores"}
        </button>
      </div>
      {msg && (
        <Said ok={msg.ok} testid="gradebook-result">
          {msg.text}
        </Said>
      )}
    </div>
  );
}

/** One check's override form: pass or fail, plus a required note. */
export function OverrideForm({ attemptId, checkKey, label, pass }: { attemptId: string; checkKey: string; label: string; pass: boolean }) {
  const [value, setValue] = useState(pass ? "pass" : "fail");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="st-ov"
      data-testid={`override-${checkKey}`}
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        if (!note.trim()) {
          setMsg({ ok: false, text: "Add a short note saying why" });
          return;
        }
        start(async () => {
          const r = await overrideCheckAction(attemptId, checkKey, value === "pass", note);
          if (r.ok) {
            setNote("");
            setMsg({ ok: true, text: "Saved with your note" });
          } else setMsg({ ok: false, text: r.error });
        });
      }}
    >
      <p className="st-ov-head">
        <b>{label.replace(/\?$/, "")}</b>
        <span>Now: {pass ? "pass" : "fail"}</span>
      </p>
      <div className="st-ov-fields">
        <div className="st-field st-field-score">
          <label htmlFor={`ov-${checkKey}`}>Score</label>
          <select id={`ov-${checkKey}`} value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
        </div>
        <div className="st-field st-field-grow">
          <label htmlFor={`note-${checkKey}`}>Note (required)</label>
          <input id={`note-${checkKey}`} type="text" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Why you changed it" />
        </div>
        <button type="submit" className={LINE} disabled={pending}>
          {pending ? "Saving…" : "Save score"}
        </button>
      </div>
      {msg && <Said ok={msg.ok}>{msg.text}</Said>}
    </form>
  );
}

/** Close a flag after following up. The note is required and goes to the audit log. */
export function ResolveFlagForm({ flagId, label, placeholder, primary = false }: { flagId: number; label: string; placeholder: string; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (msg?.ok) {
    return (
      <Said ok testid="flag-resolved">
        {msg.text}
      </Said>
    );
  }
  if (!open) {
    return (
      <button type="button" className={primary ? MAIN : LINE} onClick={() => setOpen(true)} data-testid={`resolve-flag-${flagId}`}>
        {label}
      </button>
    );
  }
  return (
    <form
      className="st-ov st-ov-flag"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        if (!note.trim()) {
          setMsg({ ok: false, text: "Add a short note first" });
          return;
        }
        start(async () => {
          const r = await resolveFlagAction(flagId, note);
          setMsg(r.ok ? { ok: true, text: "Done. It is off your list, and your note is saved." } : { ok: false, text: r.error });
        });
      }}
    >
      <div className="st-ov-fields">
        <div className="st-field st-field-grow">
          <label htmlFor={`flag-note-${flagId}`}>Note (only staff see it)</label>
          <input id={`flag-note-${flagId}`} type="text" value={note} maxLength={500} autoFocus onChange={(e) => setNote(e.target.value)} placeholder={placeholder} />
        </div>
        <button type="submit" className={MAIN} disabled={pending} data-testid="resolve-flag-save">
          {pending ? "Saving…" : "Save note"}
        </button>
        <button type="button" className="ds-quiet st-cancel" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {msg && <Said ok={false}>{msg.text}</Said>}
    </form>
  );
}

/** Change one student's daily token limit. A reason is required; the change is logged with the old and new limit. */
export function DailyLimitForm({ studentId, current, min, max }: { studentId: string; current: number; min: number; max: number }) {
  const [value, setValue] = useState(String(current));
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <form
      className="st-ov st-limit-form"
      data-testid="daily-limit-form"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        const n = Number(value.replace(/[,\s]/g, ""));
        if (!Number.isInteger(n) || n < min || n > max) {
          setMsg({ ok: false, text: `Pick a whole number from ${fmt(min)} to ${fmt(max)}` });
          return;
        }
        if (!reason.trim()) {
          setMsg({ ok: false, text: "Add a short reason for the change" });
          return;
        }
        start(async () => {
          const r = await setDailyCapAction(studentId, n, reason);
          if (r.ok) {
            setReason("");
            setMsg({ ok: true, text: `Limit set to ${fmt(r.value)} tokens a day. The change is logged with your reason` });
          } else setMsg({ ok: false, text: r.error });
        });
      }}
    >
      <div className="st-ov-fields">
        <div className="st-field st-field-tokens">
          <label htmlFor="limit-tokens">New daily limit (tokens)</label>
          <input
            id="limit-tokens"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-describedby="limit-range"
            data-testid="limit-tokens"
          />
        </div>
        <div className="st-field st-field-grow">
          <label htmlFor="limit-reason">Reason (required)</label>
          <input
            id="limit-reason"
            type="text"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="For example: Make-up session after missing class"
            data-testid="limit-reason"
          />
        </div>
        <button type="submit" className={LINE} disabled={pending} data-testid="set-limit">
          {pending ? "Saving…" : "Set limit"}
        </button>
      </div>
      <p className="st-fine" id="limit-range">
        From {fmt(min)} to {fmt(max)} tokens. Admins see every change in the limit log
      </p>
      {msg && (
        <Said ok={msg.ok} testid="limit-result">
          {msg.text}
        </Said>
      )}
    </form>
  );
}
