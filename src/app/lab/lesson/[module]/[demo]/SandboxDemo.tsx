"use client";

import { useEffect, useRef, useState } from "react";
import { markDemoDoneAction } from "@/app/lab/actions";
import { CoachSide } from "@/components/AskCoach";
import { DraftBlock, DraftControls, ToolPanels, type DraftView } from "@/components/ToolPanels";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { Sheet } from "@/design/Sheet";
import { panelsAt, type Demo } from "@/lib/sandbox/demos";
import { TOOL_LABELS } from "@/lib/sandbox/tools";

/**
 * A scripted agent demo. No model calls: the steps come from src/lib/sandbox/demos.ts, so it works when Claude is down.
 * The student reveals the agent's steps with Continue (or Play). The four tool panels update as the agent uses them.
 * At the outbox draft the student must choose Approve or Send back. Reaching the end (the draft approved) saves
 * the demo as done, the same way a finished lesson is saved. Reduced motion: Play jumps to the approval step at once.
 */

const PLAY_MS = 1700;

function reduced(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function SandboxDemo({
  demo,
  where,
  next,
  coachExerciseId,
}: {
  demo: Demo;
  /** For example "Demo 1 of 2". */
  where: string;
  /** What follows this demo on the course map. */
  next: { title: string; href: string } | null;
  coachExerciseId: string;
}) {
  const [shown, setShown] = useState(0);
  const [sentBack, setSentBack] = useState(false);
  const [approved, setApproved] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const slab = useRef<HTMLDivElement>(null);
  const total = demo.steps.length;
  const atGate = shown === total && !approved;
  const gate = demo.steps.find((s) => s.draft);
  const draft = gate?.draft;

  // Play: one step every PLAY_MS until the approval step. Reduced motion shows the approval step at once (togglePlay).
  const running = playing && shown < total;
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), PLAY_MS);
    return () => window.clearTimeout(t);
  }, [running, shown]);

  function togglePlay() {
    if (running) {
      setPlaying(false);
    } else if (reduced()) {
      setShown(total);
    } else {
      setPlaying(true);
    }
  }

  // The end of the demo counts as done, saved once.
  useEffect(() => {
    if (!approved) return;
    markDemoDoneAction(demo.id)
      .then((r) => setSaveFailed(!r.ok))
      .catch(() => setSaveFailed(true));
  }, [approved, demo.id]);

  function approve() {
    setPlaying(false);
    setApproved(true);
  }
  function sendBack() {
    setPlaying(false);
    setSentBack(true);
    // The Send back button leaves with the click, so keep keyboard focus on Approve.
    window.requestAnimationFrame(() => slab.current?.querySelector<HTMLElement>('[data-testid="demo-approve"]')?.focus());
  }
  function restart() {
    setShown(0);
    setSentBack(false);
    setApproved(false);
    setPlaying(false);
    setSaveFailed(false);
  }

  const panels = panelsAt(demo, shown, sentBack);
  const drafts: DraftView[] = panels.draft
    ? [{ id: "D1", ...panels.draft, status: approved ? "sent" : "waiting" }]
    : [];
  const sheetRead = panels.sheetRead;

  const note = approved
    ? ""
    : atGate
      ? "Approve or send back the draft to continue"
      : shown === 0
        ? "The agent has not started"
        : `Step ${shown} of ${total}`;

  return (
    <div className="ds-work">
      <Sheet
        className="ds-rise ln-i1"
        kicker={`${where}, watch the agent work`}
        title={demo.title}
        brief={demo.scenario}
        actions={
          <>
            <span className="ln-foot-line" aria-live="polite">
              {note}
            </span>
            {approved ? (
              next ? (
                <Button href={next.href} arrow data-testid="demo-next">
                  Continue
                </Button>
              ) : (
                <Button href="/lab" arrow data-testid="demo-next">
                  Continue
                </Button>
              )
            ) : (
              <Button arrow disabled={atGate} onClick={() => setShown((n) => Math.min(total, n + 1))} data-testid="demo-continue">
                Continue
              </Button>
            )}
          </>
        }
      >
        <div className="ln-task" data-testid="sandbox-demo" data-state={approved ? "done" : atGate ? "gate" : "running"}>
          <p className="ln-question">Step through what the agent does. When it drafts an email, you decide what happens to it</p>
          <div className="ln-say">
            <span className="ln-label">{demo.request.from}</span>
            <p>{demo.request.text}</p>
          </div>
        </div>

        <div className="ds-slab ds-sq ln-slab sb-stage" ref={slab}>
          <h2 className="ln-label sb-region">Tools</h2>
          <ToolPanels
            granted={demo.tools}
            sheet={{ name: demo.sheet.name, columns: demo.sheet.columns, rows: demo.sheet.rows, read: sheetRead, idle: "Not read yet" }}
            notes={panels.notes.map((text) => ({ text }))}
            memory={panels.memory.map((text) => ({ text }))}
            drafts={drafts}
          />

          <div className="sb-bar">
            <h2 className="ln-label">What the agent does</h2>
            <div className="ln-demo-ctl">
              {approved ? (
                <button type="button" className="ln-demo-btn" onClick={restart} data-testid="demo-replay">
                  Replay demo
                </button>
              ) : (
                <button type="button" className="ln-demo-btn" data-testid="demo-play" aria-pressed={running} disabled={atGate} onClick={togglePlay}>
                  {!running && <Icon name="play" />}
                  {running ? "Pause" : "Play"}
                </button>
              )}
            </div>
          </div>

          <ol className="sb-trace" aria-live="polite" aria-label="The agent's steps" data-testid="demo-trace">
            {shown === 0 && <li className="sb-idle">Press Continue to start</li>}
            {demo.steps.slice(0, shown).map((s, i) => (
              <li key={s.id} className="sb-beat" data-testid={`demo-step-${i + 1}`}>
                <span className="ln-label">Agent thinks</span>
                <p>{s.reasoning}</p>
                {s.call && (
                  <div className="sb-call">
                    <span className="ln-label">Uses {TOOL_LABELS[s.call.tool]}, simulated</span>
                    <dl className="sb-input">
                      <div>
                        <dt>Tool</dt>
                        <dd>{s.call.name}</dd>
                      </div>
                      {Object.entries(s.call.input).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="sb-result">
                      <Icon name="check" />
                      <span>{s.call.result}</span>
                    </p>
                  </div>
                )}
              </li>
            ))}
            {shown === total && sentBack && draft && (
              <li className="sb-beat" data-testid="demo-revised">
                <span className="ln-label">Agent thinks</span>
                <p>{draft.revised.reasoning}</p>
              </li>
            )}
            {shown === total && draft && (
              <li className="sb-beat sb-gate" data-testid="demo-gate">
                <span className="ln-label">{sentBack ? "The revised draft in the outbox" : "The draft in the outbox"}</span>
                <DraftBlock draft={{ to: draft.to, subject: draft.subject, body: sentBack ? draft.revised.body : draft.body }} />
                {!approved && (
                  <>
                    <p className="sb-status">
                      <Icon name="clock" />
                      <span>Waiting for approval</span>
                    </p>
                    <DraftControls onApprove={approve} onSendBack={sendBack} canSendBack={!sentBack} approveTestId="demo-approve" sendBackTestId="demo-send-back" />
                  </>
                )}
              </li>
            )}
            {approved && (
              <li className="sb-beat" data-testid="demo-sent">
                <p className="sb-status sb-done">
                  <Icon name="check" />
                  <span>{demo.sent}</span>
                </p>
              </li>
            )}
          </ol>
        </div>
        {saveFailed && <p className="ln-hint">Your progress could not be saved. You can still continue</p>}

        {approved && (
          <section className="ln-section" aria-labelledby="learned" data-testid="demo-learned">
            <h2 className="ln-h" id="learned">
              What this showed
            </h2>
            <dl className="ln-notes">
              {demo.teach.map((t) => (
                <div key={t.title}>
                  <dt>{t.title}</dt>
                  <dd>{t.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </Sheet>

      <CoachSide
        className="ds-rise ln-i2"
        exerciseId={coachExerciseId}
        module="M03"
        score={approved ? <span className="ds-coach-score">Demo</span> : undefined}
        empty="Step through the demo, then ask me anything about it"
        next={next}
        arriveKey={approved ? "done" : "idle"}
      >
        {approved ? (
          <div className="ds-tip" style={{ "--tip-delay": "200ms" } as React.CSSProperties}>
            <small>One tip</small>
            <p>Before you build, list what the job needs. Then give the agent only those tools.</p>
          </div>
        ) : null}
      </CoachSide>
    </div>
  );
}
