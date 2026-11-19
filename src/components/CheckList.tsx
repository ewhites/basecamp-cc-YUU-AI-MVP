import { Icon } from "@/design/icons";
import { getExercise } from "@/lib/curriculum/exercises";
import { SKILL_LABELS, type Skill } from "@/lib/curriculum/types";
import { TOOLS_CHECK } from "@/lib/sandbox/tools";

export interface CheckLike {
  key: string;
  skill: string;
  pass: boolean;
  evidence: string;
  reason: string;
  needsReview: boolean;
  method?: string;
  overridden?: boolean;
  overrideNote?: string | null;
  /** False when the quote was not found in the student's text (verify.ts). Missing means verified. */
  evidenceVerified?: boolean;
}

/**
 * Rubric checks as rows: a tick or a minus, the check, the student's own words as evidence, and the reason.
 * A check whose quote was not found says "Needs facilitator review" and is never shown as met.
 * Inside the coach panel the rows arrive 180ms apart (learn.css); elsewhere they show at once.
 * Props are unchanged from the first version (the facilitator's student page passes `staff`); `texts` is optional.
 */
export function CheckList({
  exerciseId,
  checks,
  staff = false,
  texts,
}: {
  exerciseId: string;
  checks: CheckLike[];
  staff?: boolean;
  /** Check wording by key, for exercises outside the practice list (the skills checks). */
  texts?: Record<string, string>;
}) {
  const ex = getExercise(exerciseId);
  const keys = texts ? Object.keys(texts) : (ex?.checks.map((c) => c.key) ?? []);
  // The tools check is decided in code after the coach grades, so it is not in the exercise's own list. It shows last.
  const text = (k: string) => texts?.[k] ?? ex?.checks.find((c) => c.key === k)?.text ?? (k === TOOLS_CHECK.key ? TOOLS_CHECK.text : k);
  const order = (k: string) => (keys.includes(k) ? keys.indexOf(k) : keys.length);
  return (
    <ul className="ln-checks" data-testid="check-list">
      {[...checks]
        .sort((a, b) => order(a.key) - order(b.key))
        .map((c, i) => {
          const state = c.needsReview ? "review" : c.pass ? "pass" : "fail";
          const coded = c.method === "code";
          const verified = c.evidenceVerified !== false;
          const quote = !coded && c.evidence ? c.evidence : "";
          const meta = [staff ? (SKILL_LABELS[c.skill as Skill] ?? c.skill) : null, coded ? "Checked in code, not by the AI" : null].filter(Boolean).join(". ");
          return (
            <li key={c.key} className="ln-check" data-testid={`check-${c.key}`} data-state={state} style={{ "--n": i + 1 } as React.CSSProperties}>
              <Icon name={state === "pass" ? "check" : state === "review" ? "flag" : "minus"} />
              <b>
                <span className="ds-sr">{state === "pass" ? "Met: " : state === "review" ? "Needs review: " : "Missing: "}</span>
                {text(c.key)}
              </b>
              {quote && verified && (
                <q>
                  <span className="ds-sr">{staff ? "Student's words: " : "Your words: "}</span>
                  {quote}
                </q>
              )}
              {c.needsReview && (
                <span className="ln-check-flag">
                  {quote && !verified
                    ? staff
                      ? "Quote not found in the student's text. Needs facilitator review"
                      : "Quote not found in your words. Needs facilitator review"
                    : "Needs facilitator review"}
                </span>
              )}
              {c.reason && <span className="ln-check-why">{c.reason}</span>}
              {meta && <span className="ln-check-meta">{meta}</span>}
              {c.overridden && <span className="ln-check-flag">Facilitator changed this score{c.overrideNote ? `: ${c.overrideNote}` : ""}</span>}
            </li>
          );
        })}
    </ul>
  );
}
