import { SKILL_BLURBS, SKILL_LABELS, SKILLS } from "@/lib/curriculum/types";
import type { SkillScores } from "@/lib/progress";

const pct = (x: number | null) => (x === null ? null : Math.round(x * 100));

/**
 * The four fluency skills as rows. Before the final check: one bar per skill (the starting point).
 * After it: two thin bars per skill, starting point then final, so the change reads at a glance.
 * Works on the cream sheet and on glass (it only uses the shared colour tokens).
 */
export function SkillBars({ start, final }: { start: SkillScores; final?: SkillScores }) {
  const hasFinal = !!final && SKILLS.some((s) => final[s] !== null);
  return (
    <div className="ds-skills">
      <ul className="ds-rows">
        {SKILLS.map((s) => {
          const a = pct(start[s]);
          const b = hasFinal ? pct(final![s]) : null;
          const value =
            a === null && b === null ? "Not taken"
            : !hasFinal ? `${a}%`
            : `${a === null ? "not taken" : `${a}%`} to ${b === null ? "not yet" : `${b}%`}`;
          return (
            <li key={s} className="ds-skill" data-testid={`skill-${s}`}>
              <div className="ds-skill-head">
                <b>{SKILL_LABELS[s]}</b>
                <span className="ds-num">{value}</span>
              </div>
              <span className="ds-skill-blurb">{SKILL_BLURBS[s]}</span>
              <div className="ds-skill-bars">
                <div className="ds-track ds-track-start" role="img" aria-label={`Starting point: ${a === null ? "not taken" : `${a}%`}`}>
                  <i style={{ width: `${a ?? 0}%` }} />
                </div>
                {hasFinal && (
                  <div className="ds-track" role="img" aria-label={`Final check: ${b === null ? "not taken" : `${b}%`}`}>
                    <i style={{ width: `${b ?? 0}%` }} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {hasFinal && (
        <p className="ds-skill-key" aria-hidden>
          <span><i className="ds-key-start" />Starting point</span>
          <span><i className="ds-key-final" />Final check</span>
        </p>
      )}
    </div>
  );
}
