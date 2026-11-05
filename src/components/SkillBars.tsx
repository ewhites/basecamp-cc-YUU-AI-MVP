import { SKILL_BLURBS, SKILL_LABELS, SKILLS } from "@/lib/curriculum/types";
import type { SkillScores } from "@/lib/progress";

const pct = (x: number | null) => (x === null ? null : Math.round(x * 100));

/**
 * The four fluency skills. Before the final check: one bar per skill (the starting point).
 * After it: two thin bars per skill, starting point then final, so the change reads at a glance.
 */
export function SkillBars({ start, final }: { start: SkillScores; final?: SkillScores }) {
  const hasFinal = !!final && SKILLS.some((s) => final[s] !== null);
  return (
    <div className="stack">
      <div className="skillbars">
        {SKILLS.map((s) => {
          const a = pct(start[s]);
          const b = hasFinal ? pct(final![s]) : null;
          const value =
            a === null && b === null ? "Not taken"
            : !hasFinal ? `${a}%`
            : `${a === null ? "not taken" : `${a}%`} → ${b === null ? "not yet" : `${b}%`}`;
          return (
            <div key={s} className="skillbar" data-testid={`skill-${s}`}>
              <div className="skillbar-head">
                <b>{SKILL_LABELS[s]}</b>
                <span className="skillbar-value">{value}</span>
              </div>
              <div className="tiny muted">{SKILL_BLURBS[s]}</div>
              {hasFinal ? (
                <div className="skillbar-bars">
                  <div className="bar skillbar-start" role="img" aria-label={`Starting point: ${a === null ? "not taken" : `${a}%`}`}>
                    <span style={{ width: `${a ?? 0}%` }} />
                  </div>
                  <div className="bar bar-ok" role="img" aria-label={`Final check: ${b === null ? "not taken" : `${b}%`}`}>
                    <span style={{ width: `${b ?? 0}%` }} />
                  </div>
                </div>
              ) : (
                <div className="skillbar-bars">
                  <div className="bar" role="img" aria-label={`Starting point: ${a === null ? "not taken" : `${a}%`}`}>
                    <span style={{ width: `${a ?? 0}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {hasFinal && (
        <div className="legend" aria-hidden>
          <span style={{ "--c": "var(--faint)" } as React.CSSProperties}>Starting point</span>
          <span style={{ "--c": "var(--ok)" } as React.CSSProperties}>Final check</span>
        </div>
      )}
    </div>
  );
}
