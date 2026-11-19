import Link from "next/link";
import { notFound } from "next/navigation";
import { Material } from "@/components/ExercisePicker";
import { SkillBars } from "@/components/SkillBars";
import { Button } from "@/design/Button";
import { Progress } from "@/design/Progress";
import { Sheet } from "@/design/Sheet";
import { Crumbs, Fold, Panel, RowLink, Section } from "@/design/Structure";
import { DISTRESS_RESPONSE } from "@/lib/coach/distress";
import { COURSE } from "@/lib/curriculum/course";
import { skillCheck } from "@/lib/curriculum/skill-checks";
import { SKILL_LABELS, type Exercise } from "@/lib/curriculum/types";
import { myProgress } from "@/lib/progress";
import { requireRole } from "@/lib/session";
import { myCheckAnswers, type CheckAnswer } from "@/lib/student-data";
import { CheckTask } from "../CheckTask";

type Kind = "start" | "final";

const COPY: Record<Kind, { title: string; group: string; intro: string }> = {
  start: {
    title: "Starting point check",
    group: "Start here",
    intro: "Short tasks, one for each AI skill. It isn't graded. It shows where you're starting, so you can see how far you've come.",
  },
  final: {
    title: "Final check",
    group: "Finish",
    intro: "Same skills, new tasks. At the end you'll see each skill next to your starting point.",
  },
};

const skillOf = (ex: Exercise) => ex.checks[0]!.skill;

/** A stored answer as the task screen shows it. Revisited distress and pending answers get their message back. */
function forScreen(a: CheckAnswer | undefined): CheckAnswer | null {
  if (!a) return null;
  if (a.status === "distress") return { ...a, message: DISTRESS_RESPONSE, answer: null };
  return a;
}

export default async function CheckPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ task?: string; done?: string }>;
}) {
  const { kind } = await params;
  if (kind !== "start" && kind !== "final") notFound();
  await requireRole("student");
  const sp = await searchParams;

  const tasks = skillCheck(kind);
  const base = `/lab/check/${kind}`;
  const copy = COPY[kind];
  const [checks, progress] = await Promise.all([myCheckAnswers(), myProgress()]);
  const answered = tasks.map((t) => !!checks.latest[t.id]);
  const firstOpen = answered.indexOf(false);
  const count = answered.filter(Boolean).length;

  // ---------------- one task ----------------
  const n = Number(sp.task);
  if (Number.isInteger(n) && n >= 1 && n <= tasks.length) {
    const ex = tasks[n - 1]!;
    const latest = forScreen(checks.latest[ex.id]);
    const last = n === tasks.length;
    return (
      <div className="ds-page ln-page" data-testid="check-task">
        <Crumbs items={[{ label: "Home", href: "/lab" }, { label: copy.title, href: base }, { label: `Task ${n} of ${tasks.length}` }]} />
        <Progress className="ln-where ds-rise" label={copy.title} value={count / tasks.length} end={`Task ${n} of ${tasks.length}`} />
        <CheckTask
          key={ex.id}
          exerciseId={ex.id}
          module={ex.module}
          kicker={SKILL_LABELS[skillOf(ex)]}
          title={ex.title}
          brief={ex.scenario}
          material={ex.material ? <Material label={ex.material.label} text={ex.material.text} open /> : undefined}
          question={ex.brief}
          checkTexts={Object.fromEntries(ex.checks.map((c) => [c.key, c.text]))}
          initial={latest}
          initialAnswer={latest?.answer ?? ""}
          nextHref={last ? `${base}?done=1` : `${base}?task=${n + 1}`}
          nextLabel={last ? "See your results" : "Continue"}
        />
      </div>
    );
  }

  // ---------------- done ----------------
  if (sp.done) {
    const missing = answered.filter((a) => !a).length;
    const waiting = tasks.filter((t) => checks.latest[t.id]?.status === "pending_score").length;
    const isStart = kind === "start";
    return (
      <div className="ds-page ln-page ln-solo" data-testid="check-done">
        <Crumbs items={[{ label: "Home", href: "/lab" }, { label: copy.title, href: base }, { label: "Results" }]} />
        <Progress className="ln-where ds-rise" label={copy.title} value={count / tasks.length} end={`${count} of ${tasks.length} answered`} />
        <Sheet
          className="ds-rise ln-i1"
          title={isStart ? "Your starting point" : "How far you've come"}
          brief={isStart ? "Each module builds one of these skills. The final check shows your growth." : "Each skill from your starting point to the final check."}
          actions={
            <>
              <span className="ln-foot-line">Up next: {isStart ? "Module 1, Writing prompts" : "Your skills and badge"}</span>
              <Button href={isStart ? "/lab/lesson/m1" : "/lab/skills"} arrow data-testid="check-done-next">
                {isStart ? "Start Module 1" : "See your skills"}
              </Button>
            </>
          }
        >
          {missing > 0 && (
            <p className="ln-notice">
              You answered {tasks.length - missing} of {tasks.length} tasks.{" "}
              <Link href={`${base}?task=${firstOpen + 1}`} className="ln-link">
                Answer task {firstOpen + 1}
              </Link>
            </p>
          )}
          {waiting > 0 && (
            <p className="ln-notice">
              {waiting === 1 ? "1 answer is" : `${waiting} answers are`} waiting for the coach. Your score will show here once it&apos;s ready.
            </p>
          )}
          <Section title={isStart ? "Your skills now" : "Your skills, then and now"} id="skills">
            <SkillBars start={checks.start} final={isStart ? undefined : checks.final} />
            <p className="ln-hint ln-after">Scores come from an AI coach. Your facilitator reviews them and can change any score.</p>
          </Section>
        </Sheet>
      </div>
    );
  }

  // ---------------- intro ----------------
  const m3 = COURSE.find((g) => g.module === "M03")!;
  const m3Done = m3.steps.every((s) => progress.states[s.id]?.done);
  const allDone = count === tasks.length;
  const startHref = allDone ? `${base}?done=1` : `${base}?task=${firstOpen + 1}`;
  return (
    <div className="ds-page ln-page ln-solo">
      <Crumbs items={[{ label: "Home", href: "/lab" }, { label: copy.title }]} />
      <Progress className="ln-where ds-rise" label={copy.group} value={count / tasks.length} end={`${count} of ${tasks.length} answered`} />
      <Sheet
        className="ds-rise ln-i1"
        title={copy.title}
        brief={copy.intro}
        actions={
          <Button href={startHref} arrow data-testid="check-start-button">
            {allDone ? "See your results" : count > 0 ? "Continue" : "Start the check"}
          </Button>
        }
      >
        {kind === "final" && !m3Done && <p className="ln-notice">This check works best after Module 3. You can still take it now.</p>}
        <Section title="The tasks" id="tasks" aside="About 10 minutes">
          <Panel list>
            <ol className="ds-rows ln-tasklist">
              {tasks.map((t, i) =>
                answered[i] ? (
                  <li key={t.id}>
                    <RowLink href={`${base}?task=${i + 1}`} title={t.title} meta={SKILL_LABELS[skillOf(t)]} end="Answered" />
                  </li>
                ) : (
                  <li key={t.id} className="ds-row ds-row-static">
                    <span className="ln-task-n ds-num" aria-hidden>
                      {i + 1}
                    </span>
                    <span className="ln-task-name">
                      {t.title}
                      <span className="ln-task-skill">{SKILL_LABELS[skillOf(t)]}</span>
                    </span>
                  </li>
                ),
              )}
            </ol>
          </Panel>
          <Fold label="What happens after each task">
            <p>After each task the coach shows what you did well and gives one tip.</p>
          </Fold>
        </Section>
      </Sheet>
    </div>
  );
}
