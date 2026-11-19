"use client";

import { useState, useTransition } from "react";
import { submitCheckAction } from "@/app/lab/actions";
import { ErrorLine, Slab, Split } from "@/app/lab/practice/Frame";
import { Highlighted, WriteField } from "@/app/lab/practice/WriteField";
import { CoachSide } from "@/components/AskCoach";
import { attemptQuotes } from "@/components/AttemptResult";
import { Button } from "@/design/Button";
import { Sheet } from "@/design/Sheet";
import { Panel, Section } from "@/design/Structure";
import type { AttemptView } from "@/lib/attempts";
import { CheckResult } from "./CheckResult";

/** One check task a screen: the task and your answer on the sheet, the coach's feedback beside it, then Continue. */
export function CheckTask({
  exerciseId,
  module,
  kicker,
  title,
  brief,
  material,
  question,
  checkTexts,
  initial,
  initialAnswer,
  nextHref,
  nextLabel,
}: {
  exerciseId: string;
  module?: string;
  kicker: string;
  title: string;
  brief: string;
  material?: React.ReactNode;
  question: string;
  checkTexts: Record<string, string>;
  initial: AttemptView | null;
  initialAnswer: string;
  nextHref: string;
  nextLabel: string;
}) {
  const [result, setResult] = useState<AttemptView | null>(initial);
  const [submitted, setSubmitted] = useState(initialAnswer);
  const [answer, setAnswer] = useState(initialAnswer);
  const [editing, setEditing] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    setError(null);
    startTransition(async () => {
      const r = await submitCheckAction(exerciseId, answer);
      if (r.ok) {
        setResult(r.attempt);
        setSubmitted(answer);
        setEditing(false);
      } else {
        setError(r.error);
      }
    });
  }

  const showResult = !editing && !!result;
  const quotes = attemptQuotes(result);

  let work: React.ReactNode;
  if (editing || !result) {
    work = (
      <form className="ln-work" onSubmit={submit}>
        <Slab
          note={
            pending
              ? "The coach is reading your answer"
              : "The coach checks your answer and gives one tip"
          }
          action={
            <>
              {result && !pending && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAnswer(submitted);
                    setEditing(false);
                    setError(null);
                  }}
                >
                  Keep last answer
                </Button>
              )}
              <Button
                type="submit"
                data-testid="check-submit"
                disabled={pending || !answer.trim()}
              >
                {pending ? "Checking" : "Submit answer"}
              </Button>
            </>
          }
        >
          <WriteField
            id="check-answer"
            label={question}
            value={answer}
            onChange={setAnswer}
            rows={6}
            maxLength={3000}
            disabled={pending}
            placeholder="Write your answer in a few sentences."
            testId="check-answer"
          />
        </Slab>
        {error && <ErrorLine>{error}</ErrorLine>}
      </form>
    );
  } else if (result.status === "distress") {
    work = null;
  } else {
    work = (
      <div className="ln-work">
        {submitted && (
          <Slab>
            <p key={result.id} className="ln-answer-read">
              <Highlighted text={submitted} quotes={quotes} />
            </p>
          </Slab>
        )}
        <div className="ln-actions">
          <Button
            variant="secondary"
            onClick={() => setEditing(true)}
            data-testid="check-again"
          >
            Answer again
          </Button>
          <Button href={nextHref} arrow data-testid="check-next">
            {nextLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-work">
      <Sheet
        className="ds-rise ln-i1"
        kicker={kicker}
        title={title}
        brief={brief}
      >
        <Split
          kind="check"
          a={
            <Section title="Your task" id="task">
              <Panel>
                <p className="ln-read" id="check-question">
                  {question}
                </p>
              </Panel>
              {material}
            </Section>
          }
          b={
            work ? (
              <Section title="Your answer" id="work">
                {work}
              </Section>
            ) : null
          }
        />
      </Sheet>
      <CoachSide
        className="ds-rise ln-i2"
        exerciseId={exerciseId}
        module={module}
        result={
          showResult ? (
            <CheckResult
              attempt={result!}
              checkTexts={checkTexts}
              exerciseId={exerciseId}
            />
          ) : undefined
        }
        empty="Submit your answer to see what you did well"
        next={
          showResult && result!.status !== "distress"
            ? { href: nextHref }
            : null
        }
        arriveKey={showResult ? result!.id : undefined}
      />
    </div>
  );
}
