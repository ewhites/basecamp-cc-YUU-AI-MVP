import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SkillBars } from "@/components/SkillBars";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { Sheet } from "@/design/Sheet";
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
const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;
const noStop = (s: string) => s.replace(/\.$/, "");

/** A step's status as plain text, with an icon where it helps, so it never relies on colour alone. */
function StepState({ step, progress }: { step: CourseStep; progress: CourseProgress }) {
  const st = progress.states[step.id];
  if (st?.done)
    return (
      <span className="en-row-state">
        <Icon name="check" />
        Done
      </span>
    );
  if (progress.next?.id === step.id)
    return (
      <span className="en-row-state" data-state="next">
        Up next
      </span>
    );
  if (st?.started)
    return <span className="en-row-state">{st.best ? `Best ${st.best.passed} of ${st.best.total}` : "Started"}</span>;
  return <span className="en-row-state">{step.minutes} min</span>;
}

/**
 * Course home. Where you are (one progress line across the whole curriculum), "Up next", the three module doors
 * (a finished module's door is lit: the lamp signature), then every step as a row that opens it.
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

  return (
    <div className="ds-page en-home">
      <header className="en-home-head ds-rise">
        <p className="ds-kicker">AI Foundations{v.student?.section_id ? `, Section ${v.student.section_id}` : ""}</p>
        <h1>Your course</h1>
        <Progress label="Course" value={progress.total ? progress.done / progress.total : 0} end={`${progress.done} of ${progress.total} steps`} />
      </header>

      {next ? (
        <section className="ds-sheet ds-sq en-next ds-rise" style={rise(1)} data-testid="up-next" aria-labelledby="next-title">
          <div>
            <p className="ds-kicker">
              Up next, {KIND_LABEL[next.kind].toLowerCase()}, {next.minutes} min
            </p>
            <h2 id="next-title">{next.title}</h2>
            <p className="ds-brief">
              {next.id === "check-start"
                ? `${startTasks} short tasks, not graded. It shows where you start, so you can see how far you come.`
                : next.id === "check-final"
                  ? "The same skills as your starting point, with new tasks."
                  : noStop(COURSE.find((g) => g.steps.some((s) => s.id === next.id))?.blurb ?? "")}
            </p>
          </div>
          <Button href={next.href} data-testid="next-step">
            {progress.states[next.id]?.started ? "Continue" : START_LABEL[next.kind]}
          </Button>
        </section>
      ) : (
        <section className="ds-sheet ds-sq en-next ds-rise" style={rise(1)} aria-labelledby="next-title">
          <div>
            <h2 id="next-title">You finished the course</h2>
            <p className="ds-brief">See how your skills grew from your starting point.</p>
          </div>
          <Button href="/lab/skills">See your skills</Button>
        </section>
      )}

      <section aria-labelledby="doors-title" className="ds-rise" style={rise(2)}>
        <h2 id="doors-title" className="ds-sr">
          Modules
        </h2>
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
                <Link href={open.href} className={`en-door ds-glass${lit ? " is-lit" : ""}`}>
                  <span className="en-lamp" aria-hidden />
                  <small>
                    Module {info.number}
                    {lit ? ", done" : current ? ", up next" : ""}
                  </small>
                  <h3>{info.title}</h3>
                  <p>{noStop(info.blurb)}</p>
                  <span className="en-meter" role="img" aria-label={`${done} of ${g.steps.length} steps done`}>
                    {g.steps.map((s) => (
                      <i key={s.id} className={progress.states[s.id]?.done ? "is-on" : undefined} />
                    ))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <Sheet as="section" className="en-rows-sheet ds-rise" style={rise(3)} titleAs="h2" title="All steps" titleId="steps-title">
        {COURSE.map((g) => (
          <div key={g.id} className="en-group">
            <h3>{g.title}</h3>
            <ul className="ds-rows">
              {g.steps.map((s) => (
                <li key={s.id}>
                  <Link href={s.href} className="en-row" aria-current={next?.id === s.id ? "step" : undefined}>
                    <span className="en-row-text">
                      <span className="en-row-kind">{KIND_LABEL[s.kind]}</span>
                      <b>{s.title}</b>
                    </span>
                    <StepState step={s} progress={progress} />
                    <Icon name="arrow" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Sheet>

      {(focus || tookStart) && (
        <Sheet as="section" className="en-rows-sheet ds-rise" style={rise(4)} titleAs="h2" title={tookStart ? "Your starting point" : "Work on this"}>
          {focus && (
            <div className="en-focus" data-testid="focus">
              <h3 className="en-note-title">{tookStart ? `Work on this: ${focus.check}` : focus.check}</h3>
              <p>
                Your coach marked this as missed on {focus.missed} of your last {focus.tries} tries. {focus.looksLike}
              </p>
              <Button variant="quiet" href={stepFor(focus.exerciseId)?.href ?? `/lab/practice/${focus.exerciseId}`}>
                Practice it again
              </Button>
            </div>
          )}
          {tookStart && (
            <section aria-label="Skills" style={{ marginTop: focus ? 24 : 0 }}>
              <div className="en-head-row">
                <span />
                <Button variant="quiet" href="/lab/skills">
                  See all your skills
                </Button>
              </div>
              <SkillBars start={checks.start} final={checks.final} />
            </section>
          )}
        </Sheet>
      )}
    </div>
  );
}
