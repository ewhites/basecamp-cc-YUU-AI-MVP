"use client";

import { useState } from "react";
import { Button } from "@/design/Button";
import { Panel } from "@/design/Structure";
import { looksPersonal, PersonalWarning } from "@/app/lab/practice/personal";
import type { FadedExample as Faded, LessonPart } from "@/lib/curriculum/lessons";
import { Comparison, ExampleRows } from "./ui";

/** "Your turn": a near-complete example with one part missing. Runs in the browser only, no AI call. */
export function FadedExample({ faded, parts }: { faded: Faded; parts: LessonPart[] }) {
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);
  const part = parts.find((p) => p.key === faded.missing)!;

  const slot = (
    <>
      <label htmlFor="faded-input" className="ds-sr">
        {part.label}
      </label>
      <textarea
        id="faded-input"
        className="ln-input ln-slot-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={faded.placeholder}
        rows={3}
        aria-describedby={looksPersonal(text) ? "faded-personal" : undefined}
        data-testid="faded-input"
      />
      <PersonalWarning text={text} id="faded-personal" />
    </>
  );

  return (
    <div className="ln-stack">
      <Panel>
        <p className="ln-read">{faded.scenario}</p>
        {faded.comparison && <Comparison rows={faded.comparison} />}
        <p className="ln-read ln-ask-line">{faded.ask}</p>
      </Panel>
      <div className="ds-slab ds-sq ln-slab" aria-label={faded.head}>
        <ExampleRows segments={faded.segments} parts={parts} missing={faded.missing} slot={slot} />
      </div>
      {shown ? (
        <Panel className="ln-model" data-testid="faded-answer">
          <h3>One good answer</h3>
          <p className="ln-read">{faded.answer}</p>
          <p className="ln-hint">{faded.checkYours}</p>
        </Panel>
      ) : (
        <div>
          <Button variant="secondary" className="ln-btn-sm" onClick={() => setShown(true)} data-testid="faded-reveal">
            {text.trim() ? "Compare with a model answer" : "Show a model answer"}
          </Button>
        </div>
      )}
    </div>
  );
}
