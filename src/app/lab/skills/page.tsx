import Link from "next/link";
import { headers } from "next/headers";
import { SkillBars } from "@/components/SkillBars";
import { SampleTag } from "@/components/Tags";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { Sheet } from "@/design/Sheet";
import { COURSE } from "@/lib/curriculum/course";
import { skillCheck } from "@/lib/curriculum/skill-checks";
import { SKILL_LABELS, SKILLS } from "@/lib/curriculum/types";
import { myProgress } from "@/lib/progress";
import { requireRole } from "@/lib/session";
import { myCheckAnswers } from "@/lib/student-data";
import { portfolioToken } from "@/app/portfolio/token";
import { Badge } from "./Badge";
import { CopyLink } from "./CopyLink";
import { BADGE_LINE, SKILL_COUNT, SKILL_COUNT_WORD } from "./count";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;

type Todo = { key: string; label: string; text: string; href: string; action: string };

/** The student's skills: starting point to final check, practice per module, the AI Skills badge, and a share link. */
export default async function SkillsPage() {
  const v = await requireRole("student");
  const [checks, progress] = await Promise.all([myCheckAnswers(), myProgress()]);

  const finalTasks = skillCheck("final");
  const finalAnswered = finalTasks.filter((t) => checks.latest[t.id]).length;
  const finalDone = finalAnswered === finalTasks.length;
  const tookStart = skillCheck("start").some((t) => checks.latest[t.id]);
  const anyFinal = SKILLS.some((s) => checks.final[s] !== null);
  const earned = finalDone && SKILLS.every((s) => (checks.final[s] ?? 0) >= BADGE_LINE);

  // Exactly what's left for the badge, in the order to do it.
  const todo: Todo[] = [];
  if (!finalDone) {
    const firstOpen = finalTasks.findIndex((t) => !checks.latest[t.id]);
    todo.push({
      key: "final",
      label: "Final check",
      text: finalAnswered === 0 ? "Not taken yet" : `${finalAnswered} of ${finalTasks.length} tasks answered`,
      href: finalAnswered === 0 ? "/lab/check/final" : `/lab/check/final?task=${firstOpen + 1}`,
      action: finalAnswered === 0 ? "Take the final check" : "Continue the final check",
    });
  }
  finalTasks.forEach((t, i) => {
    const a = checks.latest[t.id];
    if (!a) return;
    const skill = t.checks[0]!.skill;
    const score = checks.final[skill];
    const href = `/lab/check/final?task=${i + 1}`;
    const label = SKILL_LABELS[skill];
    if (a.status === "pending_score") todo.push({ key: skill, label, text: "Your answer is waiting for the coach to score it", href, action: `See task ${i + 1}` });
    else if (score === null) todo.push({ key: skill, label, text: "No score yet. Answer the task again.", href, action: `Answer task ${i + 1} again` });
    else if (score < BADGE_LINE) todo.push({ key: skill, label, text: `${pct(score)} on the final check. You need ${pct(BADGE_LINE)}.`, href, action: `Answer task ${i + 1} again` });
  });
  const primary = todo[0];

  const token = portfolioToken(v.student!.id);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const sharePath = `/portfolio/${token}`;

  const modules = COURSE.filter((g) => g.module);

  return (
    <div className="ds-page st-page">
      <Sheet>
        <header className="st-head st-head-badge ds-rise" style={rise(0)}>
          <div>
            <p className="ds-kicker">Finish</p>
            <h1 className="ds-sheet-title">Your skills</h1>
            <p className="ds-brief">Where you started, where you are now, and what is left for your AI Skills badge.</p>
            <SampleTag />
          </div>
        </header>

        <section className="st-sec st-sec-first st-badge-sec ds-rise" style={rise(1)} data-testid="skills-badge" data-earned={earned ? "yes" : "no"} aria-labelledby="badge-h">
          <Badge earned={earned} count={SKILL_COUNT} />
          <div className="st-badge-copy">
            <h2 id="badge-h">AI Skills badge</h2>
            <p className="st-goal">
              <Icon name={earned ? "check" : "minus"} />
              {earned ? "Earned" : "Not yet"}
            </p>
            <p className="st-text">
              {earned
                ? `You scored ${pct(BADGE_LINE)} or better on all ${SKILL_COUNT_WORD} skills in the final check. It shows on your shared link.`
                : `Earn it by finishing the final check with ${pct(BADGE_LINE)} or better on all ${SKILL_COUNT_WORD} skills.`}
            </p>
            {!earned && todo.length > 0 && (
              <>
                <h3 className="st-h3">What is left</h3>
                <ul className="ds-rows st-todo-rows">
                  {todo.map((t) => (
                    <li key={t.key} className="ds-row st-todo-row">
                      <span className="st-todo-text">
                        <b>{t.label}</b>
                        <span>{t.text}</span>
                      </span>
                      {t !== primary && (
                        <Button href={t.href} variant="quiet">
                          {t.action}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {primary && (
                  <div className="ds-sheet-actions">
                    <Button href={primary.href} data-testid="skills-next">
                      {primary.action}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className="st-sec ds-rise" style={rise(2)} aria-labelledby="bars-h">
          <h2 id="bars-h">Skills</h2>
          <p className="st-fine">{finalDone || anyFinal ? "Starting point compared with the final check" : "From your starting point check. Your final check will show next to it."}</p>
          {tookStart || anyFinal ? (
            <SkillBars start={checks.start} final={checks.final} />
          ) : (
            <>
              <p className="st-text">No scores yet. The starting point check shows where you are starting.</p>
              <Button href="/lab/check/start" variant="quiet" className="st-preview">
                Take the starting point check
              </Button>
            </>
          )}
        </section>

        <section className="st-sec ds-rise" style={rise(3)} aria-labelledby="practice-h">
          <h2 id="practice-h">Practice</h2>
          <div className="st-modules">
            {modules.map((g) => {
              const practice = g.steps.filter((s) => s.kind === "practice");
              const done = practice.filter((s) => progress.states[s.id]?.done).length;
              return (
                <div key={g.id} className="st-module" data-testid={`skills-module-${g.module}`}>
                  <div className="st-sec-head">
                    <h3 className="st-h3">{g.title}</h3>
                    <span className="st-count ds-num">
                      {done} of {practice.length} done
                    </span>
                  </div>
                  <ul className="ds-rows">
                    {practice.map((s) => {
                      const st = progress.states[s.id];
                      return (
                        <li key={s.id} className="ds-row st-step" data-done={st?.done ? "yes" : "no"}>
                          <span className="st-step-mark" aria-hidden>
                            {st?.done && <Icon name="check" />}
                          </span>
                          <span className="ds-sr">{st?.done ? "Done: " : "Not done: "}</span>
                          <Link href={s.href} className="st-step-link">
                            {s.title}
                          </Link>
                          <span className="st-step-end ds-num">{st?.best ? `Best ${st.best.passed} of ${st.best.total}` : "Not started"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section className="st-sec ds-rise" style={rise(4)} data-testid="share-box" aria-labelledby="share-h">
          <h2 id="share-h">Share your skills</h2>
          <p className="st-text">
            Send this read-only link to an internship partner. They see your first name and last initial, your track, your {SKILL_COUNT_WORD} skill scores and your badge. They never see what you wrote.
          </p>
          <CopyLink url={`${proto}://${host}${sharePath}`} />
          <Link href={sharePath} target="_blank" className="ds-quiet st-preview" data-testid="share-preview">
            Preview what they see
            <Icon name="open" />
          </Link>
        </section>
      </Sheet>
    </div>
  );
}
