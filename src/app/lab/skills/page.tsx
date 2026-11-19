import { headers } from "next/headers";
import { SkillBars } from "@/components/SkillBars";
import { SampleTag } from "@/components/Tags";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { Sheet } from "@/design/Sheet";
import { Fold, Panel, RowLink, Section } from "@/design/Structure";
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

type Todo = {
  key: string;
  label: string;
  text: string;
  href: string;
  action: string;
};

/** The student's skills: starting point to final check, practice per module, the AI Skills badge, and a share link. */
export default async function SkillsPage() {
  const v = await requireRole("student");
  const [checks, progress] = await Promise.all([
    myCheckAnswers(),
    myProgress(),
  ]);

  const finalTasks = skillCheck("final");
  const finalAnswered = finalTasks.filter((t) => checks.latest[t.id]).length;
  const finalDone = finalAnswered === finalTasks.length;
  const tookStart = skillCheck("start").some((t) => checks.latest[t.id]);
  const anyFinal = SKILLS.some((s) => checks.final[s] !== null);
  const earned =
    finalDone && SKILLS.every((s) => (checks.final[s] ?? 0) >= BADGE_LINE);

  // Exactly what's left for the badge, in the order to do it.
  const todo: Todo[] = [];
  if (!finalDone) {
    const firstOpen = finalTasks.findIndex((t) => !checks.latest[t.id]);
    todo.push({
      key: "final",
      label: "Final check",
      text:
        finalAnswered === 0
          ? "Not taken yet"
          : `${finalAnswered} of ${finalTasks.length} tasks answered`,
      href:
        finalAnswered === 0
          ? "/lab/check/final"
          : `/lab/check/final?task=${firstOpen + 1}`,
      action:
        finalAnswered === 0
          ? "Take the final check"
          : "Continue the final check",
    });
  }
  finalTasks.forEach((t, i) => {
    const a = checks.latest[t.id];
    if (!a) return;
    const skill = t.checks[0]!.skill;
    const score = checks.final[skill];
    const href = `/lab/check/final?task=${i + 1}`;
    const label = SKILL_LABELS[skill];
    if (a.status === "pending_score")
      todo.push({
        key: skill,
        label,
        text: "Your answer is waiting for the coach to score it",
        href,
        action: `See task ${i + 1}`,
      });
    else if (score === null)
      todo.push({
        key: skill,
        label,
        text: "No score yet. Answer the task again.",
        href,
        action: `Answer task ${i + 1} again`,
      });
    else if (score < BADGE_LINE)
      todo.push({
        key: skill,
        label,
        text: `${pct(score)} on the final check. You need ${pct(BADGE_LINE)}.`,
        href,
        action: `Answer task ${i + 1} again`,
      });
  });
  const primary = todo[0];

  const token = portfolioToken(v.student!.id);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  const sharePath = `/portfolio/${token}`;

  const modules = COURSE.filter((g) => g.module);

  return (
    <div className="ds-page st-page st-skills">
      <Sheet>
        <header className="st-head ds-rise" style={rise(0)}>
          <div>
            <h1 className="ds-sheet-title">Your skills</h1>
            <p className="ds-brief">
              Where you started, where you are now, and what is left for your AI
              Skills badge.
            </p>
            <SampleTag />
          </div>
        </header>

        <div className="st-sk-top">
          <div className="st-sk-col">
            <Section
              title="AI Skills badge"
              id="badge"
              data-testid="skills-badge"
              data-earned={earned ? "yes" : "no"}
              className="ds-rise"
              style={rise(1)}
              aside={
                <span className="st-goal">
                  <Icon name={earned ? "check" : "minus"} />
                  {earned ? "Earned" : "Not yet"}
                </span>
              }
            >
              <Panel className="st-badge-panel">
                <Badge earned={earned} count={SKILL_COUNT} />
                <div className="st-badge-copy">
                  <p>
                    {earned
                      ? `You scored ${pct(BADGE_LINE)} or better on all ${SKILL_COUNT_WORD} skills in the final check. It shows on your shared link.`
                      : `Earn it by finishing the final check with ${pct(BADGE_LINE)} or better on all ${SKILL_COUNT_WORD} skills.`}
                  </p>
                  {!earned && primary && (
                    <>
                      <p className="st-todo-now">
                        <b>{primary.label}</b>
                        <span>{primary.text}</span>
                      </p>
                      <div className="st-act-row">
                        <Button href={primary.href} data-testid="skills-next">
                          {primary.action}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </Panel>
            </Section>

            {!earned && todo.length > 1 && (
              <Section
                title="Also left for the badge"
                id="left"
                className="ds-rise"
                style={rise(2)}
              >
                <Panel list>
                  <ul className="ds-rows">
                    {todo
                      .filter((t) => t !== primary)
                      .map((t) => (
                        <li key={t.key}>
                          <RowLink
                            href={t.href}
                            title={t.action}
                            meta={`${t.label}: ${t.text}`}
                          />
                        </li>
                      ))}
                  </ul>
                </Panel>
              </Section>
            )}
          </div>

          <Section
            title="Skills"
            id="bars"
            className="ds-rise"
            style={rise(2)}
            aside={
              finalDone || anyFinal
                ? "Starting point and final check"
                : undefined
            }
          >
            {tookStart || anyFinal ? (
              <Panel>
                <SkillBars start={checks.start} final={checks.final} />
              </Panel>
            ) : (
              <Panel list>
                <ul className="ds-rows">
                  <li>
                    <RowLink
                      href="/lab/check/start"
                      title="Take the starting point check"
                      meta="No scores yet"
                    />
                  </li>
                </ul>
              </Panel>
            )}
          </Section>
        </div>

        <Section
          title="Practice"
          id="practice"
          className="ds-rise"
          style={rise(3)}
        >
          <div className="st-sk-practice">
            {modules.map((g) => {
              const practice = g.steps.filter((s) => s.kind === "practice");
              const done = practice.filter(
                (s) => progress.states[s.id]?.done,
              ).length;
              return (
                <Fold
                  key={g.id}
                  label={g.title}
                  hint={`${done} of ${practice.length} done`}
                  data-testid={`skills-module-${g.module}`}
                >
                  <ul className="ds-rows st-flush">
                    {practice.map((s) => {
                      const st = progress.states[s.id];
                      return (
                        <li key={s.id} data-done={st?.done ? "yes" : "no"}>
                          <RowLink
                            href={s.href}
                            title={
                              <>
                                <span className="ds-sr">
                                  {st?.done ? "Done: " : "Not done: "}
                                </span>
                                {s.title}
                              </>
                            }
                            end={
                              <>
                                {st?.done && <Icon name="check" />}
                                {st?.best
                                  ? `Best ${st.best.passed} of ${st.best.total}`
                                  : "Not started"}
                              </>
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                </Fold>
              );
            })}
          </div>
        </Section>

        <Section
          title="Share your skills"
          id="share"
          data-testid="share-box"
          className="ds-rise"
          style={rise(4)}
          desc="A read-only link for an internship partner."
        >
          <div className="st-sk-share">
            <Panel className="st-stack">
              <CopyLink url={`${proto}://${host}${sharePath}`} />
              <div className="st-act-row">
                <Button
                  href={sharePath}
                  target="_blank"
                  variant="secondary"
                  data-testid="share-preview"
                >
                  Preview what they see
                  <Icon name="open" />
                </Button>
              </div>
            </Panel>
            <Fold label="What they can see">
              <p>
                Your first name and last initial, your track, your{" "}
                {SKILL_COUNT_WORD} skill scores and your badge. They never see
                what you wrote.
              </p>
            </Fold>
          </div>
        </Section>
      </Sheet>
    </div>
  );
}
