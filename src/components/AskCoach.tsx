"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { askLessonCoachAction } from "@/app/lab/actions";
import { useArrive } from "@/app/lab/practice/WriteField";
import { looksPersonal, PersonalWarning } from "@/app/lab/practice/personal";
import { Glass } from "@/design/Glass";
import { Icon } from "@/design/icons";
import { Panel, RowLink } from "@/design/Structure";

const EXAMPLE_QUESTION: Record<string, string> = {
  M01: "Ask about this lesson, like what a guardrail is",
  M02: "Ask about this lesson, like what Trust means",
  M03: "Ask about this lesson, like what a good handoff is",
};

interface Turn {
  q: string;
  a?: string;
  error?: string;
  distress?: boolean;
}

/**
 * Ask the coach, as a running thread: this session's questions and answers, newest at the bottom, the ask box under it.
 * Kept in browser state only (nothing is stored). The same server action as before answers each question:
 * it answers only about the current lesson and won't write the student's answer.
 */
export function AskCoach({ exerciseId, module }: { exerciseId: string; module?: string }) {
  const [q, setQ] = useState("");
  const [thread, setThread] = useState<Turn[]>([]);
  const [pending, start] = useTransition();
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread, pending]);

  function ask(e: React.FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (!question || pending) return;
    setQ("");
    setThread((t) => [...t, { q: question }]);
    start(async () => {
      const r = await askLessonCoachAction(exerciseId, question);
      setThread((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, a: r.text, error: r.error, distress: r.distress } : turn)));
    });
  }

  const warn = looksPersonal(q);
  return (
    <section className="ln-thread" data-testid="ask-coach" aria-labelledby="ask-coach-h">
      <h3 className="ln-coach-h" id="ask-coach-h">
        Ask the coach
      </h3>
      {thread.length === 0 ? (
        <p className="ln-thread-hint">Questions about this lesson only. The coach won&apos;t write your answer</p>
      ) : (
        <ol className="ln-thread-list" ref={list} aria-live="polite">
          {thread.map((t, i) => (
            <li key={i}>
              <div className="ln-turn is-you">
                <span>You</span>
                <p>{t.q}</p>
              </div>
              {(t.a || t.error) && (
                <div className={`ln-turn is-coach${t.distress ? " is-distress" : ""}`} data-testid="coach-answer">
                  <span>Coach</span>
                  <p>{t.a ?? t.error}</p>
                </div>
              )}
            </li>
          ))}
          {pending && (
            <li className="ln-turn is-coach is-wait">
              <span>Coach</span>
              <p>Thinking</p>
            </li>
          )}
        </ol>
      )}
      <form className="ds-ask" onSubmit={ask}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={EXAMPLE_QUESTION[module ?? ""] ?? "Ask about this lesson"}
          aria-label="Question for the coach"
          aria-describedby={warn ? "ask-personal" : undefined}
          autoComplete="off"
          maxLength={1500}
          data-testid="ask-coach-input"
        />
        <button type="submit" aria-label="Ask" disabled={pending || !q.trim()} data-testid="ask-coach-submit">
          <Icon name="arrow" />
        </button>
      </form>
      <div className="ln-thread-warn">
        <PersonalWarning text={q} id="ask-personal" />
      </div>
    </section>
  );
}

/**
 * The coach side panel on lesson, practice and check screens (the one warm element on the screen).
 * result: the latest attempt (with its own coach heading), or nothing yet. When `arriveKey` changes, the checks
 * arrive 180ms apart and then the tip. Earlier attempts fold under the result. Then the ask thread, then
 * a "What's next" row link (blue, with a chevron) to the same place as the screen's Continue.
 */
export function CoachSide({
  exerciseId,
  module,
  result,
  score,
  empty,
  earlier,
  next,
  arriveKey,
  children,
  className = "",
}: {
  exerciseId: string;
  module?: string;
  result?: React.ReactNode;
  /** Shown in the heading when there is no result block. */
  score?: React.ReactNode;
  /** One line when there is nothing to show yet. */
  empty?: React.ReactNode;
  earlier?: React.ReactNode;
  /** Where Continue goes. `title` names it under "What's next". */
  next?: { href: string; title?: string } | null;
  arriveKey?: unknown;
  /** Extra coach content under the heading (the lesson demo's notes). */
  children?: React.ReactNode;
  className?: string;
}) {
  const arrived = useArrive(arriveKey);
  return (
    <Glass as="aside" aria-label="Coach" className={`ds-coach ln-coach${arrived ? " is-scored" : ""} ${className}`.trim()}>
      {result ?? (
        <div className="ds-coach-head">
          <h2>Coach</h2>
          {score}
        </div>
      )}
      {children}
      {!result && !children && empty && <p className="ds-coach-empty">{empty}</p>}
      {earlier}
      <AskCoach exerciseId={exerciseId} module={module} />
      {next && (
        <Panel list className="ln-coach-next">
          <ul className="ds-rows">
            <li>
              <RowLink href={next.href} title="What's next" meta={next.title} data-testid="coach-next" />
            </li>
          </ul>
        </Panel>
      )}
    </Glass>
  );
}
