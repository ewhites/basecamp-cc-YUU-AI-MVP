import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SkillBars } from "@/components/SkillBars";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { Sheet } from "@/design/Sheet";
import { Fold, Panel, RowLink, Section } from "@/design/Structure";
import { Progress } from "@/design/Progress";
import { skillCheck } from "@/lib/curriculum/skill-checks";
import { COURSE, MODULE_INFO, stepFor, type CourseStep } from "@/lib/curriculum/course";
import type { ModuleId } from "@/lib/curriculum/types";
import { getViewer } from "@/lib/session";
import { myProgress, type Progress as CourseProgress } from "@/lib/progress";
import { myAttempts, myCheckAnswers, myFocus } from "@/lib/student-data";
import { readIntro } from "./intro";

const KIND_LABEL = { check: "Check", lesson: "Lesson", demo: "Demo", practice: "Practice", skills: "Summary" } as const;
const START_LABEL = { check: "Start check", lesson: "Start lesson", demo: "Watch demo", practice: "Start practice", skills: "See your skills" } as const;
const noStop = (s: string) => s.replace(/\.$/, "");

/** A step's status as plain text, with an icon where it helps, so it never relies on colour alone. */
function stepStatus(step: CourseStep, progress: CourseProgress): React.ReactNode {
  const st = progress.states[step.id];
  if (st?.done)
    return (
      <span className="en-state" data-state="done">
        <Icon name="check" />
        Done
      </span>
    );
  if (progress.next?.id === step.id)
    return (
      <span className="en-state" data-state="next">
        Up next
      </span>
    );
  if (st?.started) return <span className="en-state">{st.best ? `Best ${st.best.passed} of ${st.best.total}` : "Started"}</span>;
  return <span className="en-state">Not started</span>;
}

/**
 * Course home. One cream sheet, four sections: what to do next (one orange button), the three modules (each a
 * door that opens its first open step), every step as a row that opens it, and your skills (folded).
 * The lamp signature: a finished module's door carries the lit orange lamp. Nowhere else.
 */
export default async function CourseHome() {
  const v = await getViewer();
  if (!v) redirect("/");
  if (v.role !== "student") redirect("/lab/instructor");

  // The first visit, once: only when the answers cookie is missing and the student has no attempts yet.
  // Deep links go through /launch to their own page, so they never reach this.
  if (!readIntro(await cookies()) && (await myAttempts()).length === 0) redirect("/lab/welcome");

  const [progress, checks, focus] = await Promise.all([myProgress(), myCheckAnswers(), myFocus()]);
  const next = progress.next;
  const tookStart = progress.states["check-start"]?.done;
  const modules = COURSE.filter((g) => g.module);
  const startTasks = skillCheck("start").length;
  const nextBlurb = next
    ? next.id === "check-start"
      ? `${startTasks} short tasks, not graded. It shows where you start.`
      : next.id === "check-final"
        ? "The same skills as your starting point, with new tasks."
        : noStop(COURSE.find((g) => g.steps.some((s) => s.id === next.id))?.blurb ?? "")
    : "";

  return (
    <div className="ds-page en-home">
      <Sheet className="ds-rise" kicker={`AI Foundations${v.student?.section_id ? `, Section ${v.student.section_id}` : ""}`} title="Your course">
        <Progress label="Course" value={progress.total ? progress.done / progress.total : 0} end={`${progress.done} of ${progress.total} steps`} />

        {next ? (
          <Section title="Up next" id="next" data-testid="up-next">
            <Panel className="en-next">
              <div className="en-next-text">
                <h3>{next.title}</h3>
                <p className="en-next-meta">
                  {KIND_LABEL[next.kind]} · {next.minutes} min
                </p>
                {nextBlurb && <p className="en-next-blurb">{nextBlurb}</p>}
              </div>
              <Button href={next.href} data-testid="next-step">
                {progress.states[next.id]?.started ? "Continue" : START_LABEL[next.kind]}
              </Button>
            </Panel>
          </Section>
        ) : (
          <Section title="You finished the course" id="next">
            <Panel className="en-next">
              <div className="en-next-text">
                <p className="en-next-blurb">See how your skills grew from your starting point.</p>
              </div>
              <Button href="/lab/skills">See your skills</Button>
            </Panel>
          </Section>
        )}

        <Section title="Modules" id="modules">
          <ul className="en-doors">
            {modules.map((g) => {
              const m = g.module as ModuleId;
              const info = MODULE_INFO[m];
              const done = g.steps.filter((s) => progress.states[s.id]?.done).length;
              const lit = done === g.steps.length;
              const current = next?.module === m;
              const open = g.steps.find((s) => !progress.states[s.id]?.done) ?? g.steps[0]!;
              return (
                <li key={g.id}>
                  <Link href={open.href} className={`en-door ds-sq${lit ? " is-lit" : ""}`}>
                    <span className="en-door-top">
                      <small>
                        Module {info.number}
                        {lit ? ", done" : current ? ", up next" : ""}
                      </small>
                      <span className="en-lamp" aria-hidden />
                    </span>
                    <h3>{info.title}</h3>
                    <p>{noStop(info.blurb)}</p>
                    <span className="en-meter" role="img" aria-label={`${done} of ${g.steps.length} steps done`}>
                      {g.steps.map((s) => (
                        <i key={s.id} className={progress.states[s.id]?.done ? "is-on" : undefined} />
                      ))}
                    </span>
                    <span className="en-door-go">
                      {lit ? "Review module" : done ? "Continue module" : "Open module"}
                      <Icon name="chev" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="All steps" id="steps" aside={`${progress.done} of ${progress.total} done`}>
          {COURSE.map((g) => (
            <div key={g.id} className="ds-sub">
              <h3>{g.title}</h3>
              <Panel list>
                <ul className="ds-rows">
                  {g.steps.map((s) => (
                    <li key={s.id}>
                      <RowLink
                        href={s.href}
                        title={s.title}
                        meta={`${KIND_LABEL[s.kind]} · ${s.minutes} min`}
                        end={stepStatus(s, progress)}
                        aria-current={next?.id === s.id ? "step" : undefined}
                        className="en-row"
                      />
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          ))}
        </Section>

        {focus && (
          <Section title="Work on this" id="focus" data-testid="focus">
            <Panel className="en-focus">
              <h3>{focus.check}</h3>
              <p>
                Missed on {focus.missed} of your last {focus.tries} tries. {focus.looksLike}
              </p>
              <Button variant="secondary" href={stepFor(focus.exerciseId)?.href ?? `/lab/practice/${focus.exerciseId}`}>
                Practice it again
              </Button>
            </Panel>
          </Section>
        )}

        {tookStart && (
          <Section title="Your skills" id="skills">
            <Fold label="Your starting point" hint="Four skills, scored by your coach">
              <SkillBars start={checks.start} final={checks.final} />
              <div className="en-fold-act">
                <Button variant="secondary" href="/lab/skills">
                  See all your skills
                </Button>
              </div>
            </Fold>
          </Section>
        )}
      </Sheet>
    </div>
  );
}
