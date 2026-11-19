"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AnswerList } from "@/design/AnswerList";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { Progress } from "@/design/Progress";
import { Panel } from "@/design/Structure";
import { EXPERIENCE, WORK, type Experience, type Intro, type Work } from "../intro";
import { saveIntro } from "./actions";

type Start = "check" | "home";
const STEPS = 5;

const opts = <V extends string>(labels: Record<V, string>) => (Object.keys(labels) as V[]).map((value) => ({ value, label: labels[value] }));

/** The one Continue button. On the last step it submits the form and stays off while the answers save. */
function Continue({ disabled, submit, onNext }: { disabled: boolean; submit: boolean; onNext: () => void }) {
  const { pending } = useFormStatus();
  return (
    <Button
      lift
      className="en-go"
      type={submit ? "submit" : "button"}
      disabled={disabled || pending}
      onClick={submit ? undefined : onNext}
      data-testid="welcome-continue"
    >
      Continue
    </Button>
  );
}

/**
 * The first visit, the Duolingo pattern: one question a screen, a progress bar at the top, and one full-width
 * Continue that stays off until an answer is chosen. Steps: welcome, acceptable use, kind of work, AI experience,
 * find your starting point.
 */
export function Welcome({ first, tasks, minutes, initial }: { first: string; tasks: number; minutes: number; initial: Intro | null }) {
  const [at, setAt] = useState(0);
  const [out, setOut] = useState(false);
  const [work, setWork] = useState<Work | null>(initial?.work ?? null);
  const [experience, setExperience] = useState<Experience | null>(initial?.experience ?? null);
  const [start, setStart] = useState<Start | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (moved.current) title.current?.focus();
  }, [at]);

  function go(d: number) {
    const n = Math.max(0, Math.min(STEPS - 1, at + d));
    if (n === at) return;
    moved.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAt(n);
      return;
    }
    setOut(true);
    window.setTimeout(() => {
      setAt(n);
      setOut(false);
    }, 220);
  }

  const step = [
    {
      q: `Welcome, ${first}`,
      brief: `Two questions, then ${tasks} short tasks, about ${minutes} minutes. Not graded.`,
      ready: true,
    },
    {
      q: "Before you start",
      body: (
        <Panel>
          <ul className="en-use">
            <li>The coach is AI. It can be wrong, so check what it says.</li>
            <li>Do not paste personal, confidential or restricted information.</li>
            <li>Use is logged to track cost, with a daily limit.</li>
            <li>Your facilitator reviews every score.</li>
          </ul>
        </Panel>
      ),
      ready: true,
    },
    {
      q: "What kind of work are you training for",
      body: <AnswerList label="Kind of work" options={opts(WORK)} value={work} onChange={setWork} />,
      ready: !!work,
    },
    {
      q: "How much have you used AI",
      body: <AnswerList label="AI experience" options={opts(EXPERIENCE)} value={experience} onChange={setExperience} />,
      ready: !!experience,
    },
    {
      q: "Find your starting point",
      body: (
        <AnswerList
          label="Starting point"
          options={[
            { value: "check" as Start, label: `Check where I am, ${tasks} short tasks` },
            { value: "home" as Start, label: "Start at the beginning" },
          ]}
          value={start}
          onChange={setStart}
        />
      ),
      ready: !!start,
    },
  ][at]!;

  const last = at === STEPS - 1;

  return (
    <form action={saveIntro} className="en-card ds-sheet ds-sq ds-rise">
      <input type="hidden" name="work" value={work ?? ""} />
      <input type="hidden" name="experience" value={experience ?? ""} />
      <input type="hidden" name="start" value={start ?? ""} />
      <Progress label={`Step ${at + 1} of ${STEPS}`} value={(at + 1) / STEPS} />
      <div className={`en-swap${out ? " is-out" : ""}`}>
        <h1 className="en-q" ref={title} tabIndex={-1}>
          {step.q}
        </h1>
        {step.brief && <p className="en-q-brief">{step.brief}</p>}
        {step.body}
      </div>
      <div className="en-actions">
        {at > 0 && (
          <Button variant="secondary" className="en-back" onClick={() => go(-1)} disabled={out} data-testid="welcome-back">
            <Icon name="back" />
            Back
          </Button>
        )}
        <Continue disabled={!step.ready || out} submit={last} onNext={() => go(1)} />
      </div>
    </form>
  );
}
