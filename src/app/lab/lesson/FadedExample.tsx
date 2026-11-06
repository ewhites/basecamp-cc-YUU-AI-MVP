"use client";

import { useState } from "react";
import type { FadedExample as Faded, LessonPart } from "@/lib/curriculum/lessons";
import { Comparison, ExampleText, Mark } from "./ui";

/** "Your turn": a near-complete example with one part missing. Runs in the browser only, no AI call. */
export function FadedExample({ faded, parts }: { faded: Faded; parts: LessonPart[] }) {
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);
  const part = parts.find((p) => p.key === faded.missing)!;

  const slot = (
    <>
      <label htmlFor="faded-input" className="sr-only">
        {part.label}
      </label>
      <textarea
        id="faded-input"
        className={`faded-input mark-${faded.missing}-line`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={faded.placeholder}
        rows={3}
        data-testid="faded-input"
      />
    </>
  );

  return (
    <div className="stack">
      <p style={{ margin: 0 }}>{faded.scenario}</p>
      {faded.comparison && <Comparison rows={faded.comparison} />}
      <p style={{ marginBottom: 0 }}>
        <b>{faded.ask}</b>
      </p>
      <div className="example">
        <div className="example-head">{faded.head}</div>
        <ExampleText segments={faded.segments} layout={faded.layout} missing={faded.missing} slot={slot} />
      </div>
      {shown ? (
        <div className="model-answer" data-testid="faded-answer">
          <div className="eyebrow">One good answer</div>
          <p style={{ margin: "0 0 6px" }}>
            <Mark part={faded.missing}>{faded.answer}</Mark>
          </p>
          <p className="small muted" style={{ margin: 0 }}>{faded.checkYours}</p>
        </div>
      ) : (
        <div>
          <button type="button" className="btn" onClick={() => setShown(true)} data-testid="faded-reveal">
            {text.trim() ? "Compare with a model answer" : "Show a model answer"}
          </button>
        </div>
      )}
    </div>
  );
}
