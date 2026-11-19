"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CoachSide } from "@/components/AskCoach";
import { Icon } from "@/design/icons";
import type { ComparisonRow, LessonPart, Segment } from "@/lib/curriculum/lessons";
import { Comparison, ExampleRows, exampleRows, PartNotes } from "./ui";

/**
 * "Watch demo": a scripted replay of the lesson's worked example, built only from the lesson data (no model call,
 * so it costs nothing and works when Claude is down). The example types itself into a read-only surface, the
 * prewritten output appears (Module 3's bot reply; Modules 1 and 2 have none in the lesson data), then the
 * coach's notes on each part arrive one by one in the coach panel. Skip shows the end at once, and so does
 * reduced motion.
 */

export interface DemoData {
  segments: Segment[];
  layout: "inline" | "lines";
  parts: LessonPart[];
  head: string;
  scenario: string;
  comparison?: ComparisonRow[];
  exchange?: { from: string; text: string; reply: string };
  aside?: string;
  /** The tip the coach gives at the end of the demo. */
  tip: string;
}

type Phase = "idle" | "typing" | "output" | "notes" | "done";

interface DemoState {
  data: DemoData;
  phase: Phase;
  typed: number;
  run: number;
  start: () => void;
  skip: () => void;
}

const Ctx = createContext<DemoState | null>(null);

function useDemo(): DemoState {
  const v = useContext(Ctx);
  if (!v) throw new Error("Demo parts must sit inside <DemoProvider>");
  return v;
}

const CHARS_PER_TICK = 3;
const TICK_MS = 22;

function reduced(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function DemoProvider({ data, children }: { data: DemoData; children: React.ReactNode }) {
  const total = useMemo(() => exampleRows(data.segments, data.parts).reduce((n, r) => n + r.text.length, 0), [data]);
  const notesCount = useMemo(() => exampleRows(data.segments, data.parts).filter((r) => r.part).length, [data]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState(total);
  const [run, setRun] = useState(0);
  const timers = useRef<number[]>([]);

  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const finish = useCallback(() => {
    clear();
    setTyped(total);
    setPhase("done");
  }, [clear, total]);

  const start = useCallback(() => {
    clear();
    setRun((r) => r + 1);
    if (reduced()) {
      setTyped(total);
      setPhase("done");
      return;
    }
    setTyped(0);
    setPhase("typing");
  }, [clear, total]);

  // Typing: a few characters each tick, then the output, then the notes, then done.
  useEffect(() => {
    if (phase === "typing") {
      if (typed >= total) {
        timers.current.push(window.setTimeout(() => setPhase(data.exchange ? "output" : "notes"), 400));
        return;
      }
      const t = window.setTimeout(() => setTyped((n) => Math.min(total, n + CHARS_PER_TICK)), TICK_MS);
      timers.current.push(t);
      return () => window.clearTimeout(t);
    }
    if (phase === "output") {
      const t = window.setTimeout(() => setPhase("notes"), 900);
      timers.current.push(t);
      return () => window.clearTimeout(t);
    }
    if (phase === "notes") {
      const t = window.setTimeout(() => setPhase("done"), (notesCount + 2) * 180 + 600);
      timers.current.push(t);
      return () => window.clearTimeout(t);
    }
  }, [phase, typed, total, data.exchange, notesCount]);

  useEffect(() => clear, [clear]);

  const value = useMemo(() => ({ data, phase, typed, run, start, skip: finish }), [data, phase, typed, run, start, finish]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * The worked example: the scenario, Module 2's comparison, the example on the read-only dark surface, and
 * what each part does. Open by default for students new to AI (first-visit answer). Holds the demo controls.
 */
export function WorkedExample({ openByDefault }: { openByDefault: boolean }) {
  const { data, phase, typed, start, skip } = useDemo();
  const [open, setOpen] = useState(openByDefault);
  const playing = phase === "typing" || phase === "output" || phase === "notes";
  const showOutput = !!data.exchange && (phase === "idle" || phase === "output" || phase === "notes" || phase === "done");
  return (
    <details
      className="ln-section ln-worked"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        <h2 className="ln-h" id="worked">
          See it done
        </h2>
        <Icon name="down" />
      </summary>
      <div className="ln-section-body">
        <p className="ln-read">{data.scenario}</p>
        {data.comparison && <Comparison rows={data.comparison} />}
        <div className="ln-demo-bar">
          <span className="ln-label">{data.head}</span>
          <div className="ln-demo-ctl">
            {playing ? (
              <button type="button" className="ln-demo-btn" onClick={skip}>
                Skip demo
              </button>
            ) : null}
            <button
              type="button"
              className="ln-demo-btn"
              data-testid="watch-demo"
              disabled={playing}
              onClick={() => {
                setOpen(true);
                start();
              }}
            >
              <Icon name="play" />
              {phase === "idle" ? "Watch demo" : "Replay demo"}
            </button>
          </div>
        </div>
        <div className="ds-slab ds-sq ln-slab ln-demo" data-testid="worked-example" aria-label={`${data.head}, read only`} aria-busy={playing}>
          <ExampleRows segments={data.segments} parts={data.parts} typed={phase === "typing" ? typed : undefined} marked={phase === "notes" || phase === "done"} />
        </div>
        {data.exchange && (
          <div className={`ln-demo-out${showOutput ? "" : " is-waiting"}`} aria-hidden={!showOutput}>
            <span className="ln-label">How it answers a tricky message</span>
            <ol className="ln-convo">
              <li>
                <div className="ln-say">
                  <span className="ln-label">{data.exchange.from}</span>
                  <p>{data.exchange.text}</p>
                </div>
                <div className="ln-say is-bot">
                  <span className="ln-label">Bot</span>
                  <p>{data.exchange.reply}</p>
                </div>
              </li>
            </ol>
          </div>
        )}
        <PartNotes parts={data.parts} />
        {data.aside && <p className="ln-hint">{data.aside}</p>}
      </div>
    </details>
  );
}

/** The first words of a part, as the coach quotes it in the demo. */
function shortQuote(text: string, words = 8): string {
  const w = text.trim().split(/\s+/);
  return w.length <= words ? text.trim() : `${w.slice(0, words).join(" ")}…`;
}

/** The lesson's coach panel: the ask thread, and during the demo the coach's notes on each part, then one tip. */
export function LessonCoach({ exerciseId, module, next }: { exerciseId: string; module: string; next: { href: string } | null }) {
  const { data, phase, run } = useDemo();
  const notes = phase === "notes" || phase === "done";
  const rows = exampleRows(data.segments, data.parts).filter((r) => r.part);
  return (
    <CoachSide
      className="ds-rise ln-i2"
      exerciseId={exerciseId}
      module={module}
      score={notes ? <span className="ds-coach-score">Demo</span> : undefined}
      next={next}
      arriveKey={notes ? `demo-${run}` : "idle"}
    >
      {notes ? (
        <>
          <ul className="ln-checks" aria-label="The coach's notes on the example">
            {rows.map((r, i) => {
              const part = data.parts.find((p) => p.key === r.part);
              return (
                <li key={`${run}-${i}`} className="ln-check" data-state="pass" style={{ "--n": i + 1 } as React.CSSProperties}>
                  <Icon name="check" />
                  <b>{r.label}</b>
                  <q>{shortQuote(r.text)}</q>
                  {part && <span className="ln-check-why">{part.note}</span>}
                </li>
              );
            })}
          </ul>
          <div className="ds-tip" style={{ "--tip-delay": `${(rows.length + 1) * 180 + 100}ms` } as React.CSSProperties}>
            <small>One tip</small>
            <p>{data.tip}</p>
          </div>
        </>
      ) : null}
    </CoachSide>
  );
}
