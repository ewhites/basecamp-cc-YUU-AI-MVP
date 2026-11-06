import { getExercise } from "@/lib/curriculum/exercises";
import { SKILL_LABELS, type Skill } from "@/lib/curriculum/types";

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
}

/** Rubric checks with pass/fail, the quoted evidence highlighted, and the reason. */
export function CheckList({ exerciseId, checks, staff = false }: { exerciseId: string; checks: CheckLike[]; staff?: boolean }) {
  const ex = getExercise(exerciseId);
  const text = (k: string) => ex?.checks.find((c) => c.key === k)?.text ?? k;
  const order = (k: string) => ex?.checks.findIndex((c) => c.key === k) ?? 0;
  return (
    <ul className="checks" data-testid="check-list">
      {[...checks]
        .sort((a, b) => order(a.key) - order(b.key))
        .map((c) => {
          const state = c.needsReview ? "review" : c.pass ? "pass" : "fail";
          return (
            <li key={c.key} className="check" data-testid={`check-${c.key}`} data-state={state}>
              <span className={`check-icon ${state}`} aria-label={state}>
                {state === "pass" ? "✓" : state === "review" ? "?" : "✕"}
              </span>
              <div>
                <div className="row" style={{ gap: 6 }}>
                  <b>{text(c.key)}</b>
                  <span className="tag tag-quiet">{SKILL_LABELS[c.skill as Skill] ?? c.skill}</span>
                  {c.method === "code" && <span className="tag tag-sim" title="Decided in code, not by the AI">Checked in code</span>}
                  {c.needsReview && <span className="tag tag-warn">Needs instructor review</span>}
                  {c.overridden && <span className="tag tag-warn">Instructor override</span>}
                </div>
                {c.evidence && c.method !== "code" && (
                  <div className="small" style={{ marginTop: 4 }}>
                    {staff ? "Student's words" : "Your words"}: <span className="evidence">“{c.evidence}”</span>
                  </div>
                )}
                <div className="small muted">{c.reason}</div>
                {c.overridden && c.overrideNote && <div className="small">Instructor note: {c.overrideNote}</div>}
              </div>
            </li>
          );
        })}
    </ul>
  );
}
