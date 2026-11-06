import { notFound } from "next/navigation";
import { COURSE, MODULE_INFO, moduleBySlug } from "@/lib/curriculum/course";
import { lessonFor } from "@/lib/curriculum/lessons";
import { requireRole } from "@/lib/session";
import { FadedExample } from "../FadedExample";
import { StartPractice } from "../StartPractice";
import { Comparison, ExampleText, PartNotes } from "../ui";

/** A module's 5-minute lesson: why it matters, a worked example, your turn, the rule, then practice. */
export default async function LessonPage({ params }: { params: Promise<{ module: string }> }) {
  await requireRole("student");
  const { module: slug } = await params;
  const m = moduleBySlug(slug);
  if (!m) notFound();
  const info = MODULE_INFO[m];
  const lesson = lessonFor(m);
  const steps = COURSE.find((g) => g.module === m)?.steps ?? [];
  const lessonStep = steps.find((s) => s.kind === "lesson")!;
  const firstPractice = steps.find((s) => s.kind === "practice")!;
  const { worked } = lesson;

  return (
    <article className="lesson stack">
      <header>
        <div className="eyebrow">
          Module {info.number} · Lesson · {lessonStep.minutes} min
        </div>
        <h1>{info.lessonTitle}</h1>
        <p className="lead">{lesson.intro}</p>
      </header>

      <section className="card stack" aria-labelledby="worked">
        <div>
          <h2 id="worked">See it done</h2>
          <p style={{ margin: 0 }}>{worked.scenario}</p>
        </div>
        {worked.comparison && <Comparison rows={worked.comparison} />}
        <div className="example" data-testid="worked-example">
          <div className="example-head">{worked.head}</div>
          <ExampleText segments={worked.segments} layout={worked.layout} />
        </div>
        <PartNotes parts={lesson.parts} />
        {worked.exchange && (
          <div className="stack-sm">
            <div className="eyebrow">How it answers a tricky message</div>
            <div className="chat">
              <div className="bubble bubble-in">
                <div className="bubble-from">{worked.exchange.from}</div>
                {worked.exchange.text}
              </div>
              <div className="bubble bubble-out">
                <div className="bubble-from">Bot</div>
                {worked.exchange.reply}
              </div>
            </div>
          </div>
        )}
        {worked.aside && <p className="small muted" style={{ marginBottom: 0 }}>{worked.aside}</p>}
      </section>

      <section className="card stack" aria-labelledby="your-turn">
        <h2 id="your-turn" style={{ margin: 0 }}>Your turn</h2>
        <FadedExample faded={lesson.faded} parts={lesson.parts} />
      </section>

      <section className="card card-muted" aria-labelledby="rule">
        <h2 id="rule">The rule</h2>
        <ul className="recap">
          {lesson.recap.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <footer className="lesson-foot">
        <span className="small muted">Next: {firstPractice.title}</span>
        <StartPractice stepId={lessonStep.id} href={firstPractice.href} />
      </footer>
    </article>
  );
}
