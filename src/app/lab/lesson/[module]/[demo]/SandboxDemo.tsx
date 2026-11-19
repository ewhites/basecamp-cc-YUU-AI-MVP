"use client";

import { useEffect, useRef, useState } from "react";
import { markDemoDoneAction } from "@/app/lab/actions";
import { CoachSide } from "@/components/AskCoach";
import { DraftBlock, DraftControls, ToolPanels, type DraftView } from "@/components/ToolPanels";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { Sheet } from "@/design/Sheet";
import { Panel, Section } from "@/design/Structure";
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
  next,
  coachExerciseId,
}: {
  demo: Demo;
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
        <div data-testid="sandbox-demo" data-state={approved ? "done" : atGate ? "gate" : "running"} ref={slab}>
          <Section title="The request" id="request">
            <Panel>
              <p className="ln-who">{demo.request.from}</p>
              <p className="ln-read">{demo.request.text}</p>
            </Panel>
          </Section>

          <Section title="The agent's tools" id="tools" desc="Pretend tools. They fill in as the agent works">
            <ToolPanels
              granted={demo.tools}
              sheet={{ name: demo.sheet.name, columns: demo.sheet.columns, rows: demo.sheet.rows, read: sheetRead, idle: "Not read yet" }}
              notes={panels.notes.map((text) => ({ text }))}
              memory={panels.memory.map((text) => ({ text }))}
              drafts={drafts}
            />
          </Section>

          <Section
            title="What the agent does"
            id="steps"
            aside={shown > 0 && !approved ? `Step ${Math.min(shown, total)} of ${total}` : undefined}
            desc="Press Continue to reveal each step. When it drafts an email, you decide what happens to it"
          >
            <div className="sb-bar">
              {approved ? (
                <Button variant="secondary" className="ln-btn-sm" onClick={restart} data-testid="demo-replay">
                  Replay demo
                </Button>
              ) : (
                <Button variant="secondary" className="ln-btn-sm" data-testid="demo-play" aria-pressed={running} disabled={atGate} onClick={togglePlay}>
                  {!running && <Icon name="play" />}
                  {running ? "Pause" : "Play all steps"}
                </Button>
              )}
            </div>

            <Panel as="ol" className="sb-trace" aria-live="polite" aria-label="The agent's steps" data-testid="demo-trace">
              {shown === 0 && <li className="sb-idle">Press Continue to start</li>}
              {demo.steps.slice(0, shown).map((s, i) => (
                <li key={s.id} className="sb-beat" data-testid={`demo-step-${i + 1}`}>
                  <h3>Step {i + 1}</h3>
                  <p>
                    <span className="sb-tag">Thinks</span>
                    {s.reasoning}
                  </p>
                  {s.call && (
                    <div className="sb-call">
                      <p className="sb-uses">
                        Uses {TOOL_LABELS[s.call.tool]}
                        <span className="sb-sim">Simulated</span>
                      </p>
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
                  <h3>The agent revises</h3>
                  <p>
                    <span className="sb-tag">Thinks</span>
                    {draft.revised.reasoning}
                  </p>
                </li>
              )}
              {shown === total && draft && (
                <li className="sb-beat sb-gate" data-testid="demo-gate">
                  <h3>{sentBack ? "The revised draft in the outbox" : "The draft in the outbox"}</h3>
                  <DraftBlock draft={{ to: draft.to, subject: draft.subject, body: sentBack ? draft.revised.body : draft.body }} />
                  {!approved && (
                    <>
                      <p className="sb-status">
                        <Icon name="clock" />
                        <span>Waiting for approval</span>
                      </p>
                      <DraftControls main onApprove={approve} onSendBack={sendBack} canSendBack={!sentBack} approveTestId="demo-approve" sendBackTestId="demo-send-back" />
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
            </Panel>
          </Section>

          {saveFailed && <p className="ln-hint">Your progress could not be saved. You can still continue</p>}

          {approved && (
            <Section title="What this showed" id="learned" data-testid="demo-learned">
              <Panel list>
                <ul className="ds-rows ln-lessons">
                  {demo.teach.map((t) => (
                    <li key={t.title} className="ds-row">
                      <h3>{t.title}</h3>
                      <p>{t.text}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </Section>
          )}
        </div>
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
