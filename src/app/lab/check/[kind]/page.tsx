import Link from "next/link";
import { notFound } from "next/navigation";
import { SkillBars } from "@/components/SkillBars";
import { DISTRESS_RESPONSE } from "@/lib/coach/distress";
import { COURSE } from "@/lib/curriculum/course";
import { skillCheck } from "@/lib/curriculum/skill-checks";
import { SKILL_BLURBS, SKILL_LABELS, type Exercise } from "@/lib/curriculum/types";
import { myProgress } from "@/lib/progress";
import { requireRole } from "@/lib/session";
import { myCheckAnswers, type CheckAnswer } from "@/lib/student-data";
import { CheckTask } from "../CheckTask";

type Kind = "start" | "final";

const COPY: Record<Kind, { title: string; group: string; intro: string }> = {
  start: {
    title: "Starting point check",
    group: "Start here",
    intro: "Four short tasks, one for each AI skill. It isn't graded. It shows where you're starting, so you can see how far you've come.",
  },
  final: {
    title: "Final check",
    group: "Finish",
    intro: "Same four skills, new tasks. At the end you'll see each skill next to your starting point.",
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

  // ---------------- one task ----------------
  const n = Number(sp.task);
  if (Number.isInteger(n) && n >= 1 && n <= tasks.length) {
    const ex = tasks[n - 1]!;
    const skill = skillOf(ex);
    const latest = forScreen(checks.latest[ex.id]);
    const last = n === tasks.length;
    return (
      <div className="stack" data-testid="check-task" style={{ gap: 24 }}>
        <div>
          <div className="check-top">
            <Link href={base}>{copy.title}</Link>
            <span>
              Task {n} of {tasks.length}
            </span>
          </div>
          <div className="seg" aria-hidden>
            {tasks.map((t, i) => (
              <span key={t.id} className={i + 1 === n ? "on" : answered[i] ? "done" : ""} />
            ))}
          </div>
        </div>

        <div>
          <div className="eyebrow">
            {SKILL_LABELS[skill]} · {SKILL_BLURBS[skill]}
          </div>
          <h1 style={{ margin: 0 }}>{ex.title}</h1>
        </div>

        <section className="card stack">
          <p style={{ margin: 0 }}>{ex.scenario}</p>
          {ex.material && (
            <div>
              <div className="material-label">{ex.material.label}</div>
              <pre>{ex.material.text}</pre>
            </div>
          )}
          <CheckTask
            key={ex.id}
            exerciseId={ex.id}
            question={ex.brief}
            checkTexts={Object.fromEntries(ex.checks.map((c) => [c.key, c.text]))}
            initial={latest}
            initialAnswer={latest?.answer ?? ""}
            nextHref={last ? `${base}?done=1` : `${base}?task=${n + 1}`}
            nextLabel={last ? "See your results" : "Next task"}
          />
        </section>
      </div>
    );
  }

  // ---------------- done ----------------
  if (sp.done) {
    const missing = answered.filter((a) => !a).length;
    const waiting = tasks.filter((t) => checks.latest[t.id]?.status === "pending_score").length;
    const isStart = kind === "start";
    return (
      <div className="stack" data-testid="check-done" style={{ gap: 24 }}>
        <div>
          <div className="eyebrow">{copy.title}</div>
          <h1>{isStart ? "Your starting point" : "How far you've come"}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {isStart
              ? "This is where you're starting. Each module builds one of these skills, and the final check shows your growth."
              : "Each skill from your starting point to the final check."}
          </p>
        </div>

        {missing > 0 && (
          <div className="notice notice-info small">
            You answered {tasks.length - missing} of {tasks.length} tasks.{" "}
            <Link href={`${base}?task=${firstOpen + 1}`}>Answer task {firstOpen + 1}</Link>
          </div>
        )}
        {waiting > 0 && (
          <div className="notice notice-info small">
            {waiting === 1 ? "1 answer is" : `${waiting} answers are`} waiting for the coach. Your score will show here once it&apos;s ready.
          </div>
        )}

        <section className="card">
          <SkillBars start={checks.start} final={isStart ? undefined : checks.final} />
          <p className="tiny muted" style={{ margin: "16px 0 0" }}>
            Scores come from an AI coach. Your instructor reviews them and can change any score.
          </p>
        </section>

        <section className="up-next">
          <div>
            <div className="eyebrow">Up next</div>
            <h2 style={{ margin: 0 }}>{isStart ? "Module 1: Writing prompts" : "Your skills and badge"}</h2>
          </div>
          <Link href={isStart ? "/lab/lesson/m1" : "/lab/skills"} className="btn btn-primary btn-lg" data-testid="check-done-next">
            {isStart ? "Start Module 1" : "See your skills"}
          </Link>
        </section>
      </div>
    );
  }

  // ---------------- intro ----------------
  const m3 = COURSE.find((g) => g.module === "M03")!;
  const m3Done = m3.steps.every((s) => progress.states[s.id]?.done);
  const count = answered.filter(Boolean).length;
  const allDone = count === tasks.length;
  const startHref = allDone ? `${base}?done=1` : `${base}?task=${firstOpen + 1}`;
  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <div className="eyebrow">{copy.group}</div>
        <h1>{copy.title}</h1>
        <p className="muted" style={{ margin: 0 }}>{copy.intro}</p>
      </div>

      {kind === "final" && !m3Done && (
        <div className="notice notice-info small">This check works best after Module 3. You can still take it now.</div>
      )}

      <section className="card">
        <div className="row between" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>10 minutes · 4 tasks</h2>
          {count > 0 && (
            <span className="small muted">
              {count} of {tasks.length} answered
            </span>
          )}
        </div>
        <ol className="task-list">
          {tasks.map((t, i) => (
            <li key={t.id}>
              <span className={`task-num${answered[i] ? " done" : ""}`} aria-label={answered[i] ? "Answered" : undefined}>
                {answered[i] ? "✓" : i + 1}
              </span>
              <span>
                {answered[i] ? <Link href={`${base}?task=${i + 1}`}>{t.title}</Link> : t.title}
                <span className="tiny muted" style={{ display: "block" }}>
                  {SKILL_LABELS[skillOf(t)]}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="row between">
        <span className="small muted">After each task the coach shows what you did well and gives one tip.</span>
        <Link href={startHref} className="btn btn-primary btn-lg" data-testid="check-start-button">
          {allDone ? "See your results" : count > 0 ? "Continue" : "Start"}
        </Link>
      </div>
    </div>
  );
}
