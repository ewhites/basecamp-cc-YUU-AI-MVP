import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Progress } from "@/design/Progress";
import { Sheet } from "@/design/Sheet";
import { COURSE, MODULE_INFO, moduleBySlug } from "@/lib/curriculum/course";
import { lessonFor } from "@/lib/curriculum/lessons";
import { myProgress } from "@/lib/progress";
import { requireRole } from "@/lib/session";
import { exampleOpenByDefault, readIntro } from "../../intro";
import { orderedPractice } from "../../practice/order";
import { DemoProvider, LessonCoach, WorkedExample } from "../Demo";
import { FadedExample } from "../FadedExample";
import { StartPractice } from "../StartPractice";

/** A module's 5-minute lesson: the worked example first (with an optional demo), your turn, the rule, then Start practice. */
export default async function LessonPage({ params }: { params: Promise<{ module: string }> }) {
  await requireRole("student");
  const { module: slug } = await params;
  const m = moduleBySlug(slug);
  if (!m) notFound();
  const info = MODULE_INFO[m];
  const lesson = lessonFor(m);
  const group = COURSE.find((g) => g.module === m)!;
  const lessonStep = group.steps.find((s) => s.kind === "lesson")!;
  const intro = readIntro(await cookies());
  const firstPractice = orderedPractice(m, intro)[0]!;
  const progress = await myProgress();
  const doneInModule = group.steps.filter((s) => progress.states[s.id]?.done).length;
  const { worked } = lesson;

  return (
    <div className="ds-page ln-page">
      <Progress className="ln-where ds-rise" label={info.title} value={doneInModule / group.steps.length} end={`Lesson, ${lessonStep.minutes} min`} />
      <DemoProvider
        data={{
          segments: worked.segments,
          layout: worked.layout,
          parts: lesson.parts,
          head: worked.head,
          scenario: worked.scenario,
          comparison: worked.comparison,
          exchange: worked.exchange,
          aside: worked.aside,
          tip: worked.aside ?? lesson.recap[lesson.recap.length - 1]!,
        }}
      >
        <div className="ds-work">
          <Sheet
            className="ds-rise ln-i1"
            kicker={`Module ${info.number} lesson`}
            title={info.lessonTitle}
            brief={lesson.intro}
            actions={
              <>
                <span className="ln-foot-line">Up next: {firstPractice.title}</span>
                <StartPractice stepId={lessonStep.id} href={firstPractice.href} />
              </>
            }
          >
            <WorkedExample openByDefault={exampleOpenByDefault(intro)} />

            <section className="ln-section" aria-labelledby="your-turn">
              <h2 className="ln-h" id="your-turn">
                Your turn
              </h2>
              <FadedExample faded={lesson.faded} parts={lesson.parts} />
            </section>

            <section className="ln-section" aria-labelledby="rule">
              <h2 className="ln-h" id="rule">
                The rule
              </h2>
              <ol className="ln-rule">
                {lesson.recap.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </section>
          </Sheet>
          <LessonCoach exerciseId={firstPractice.exerciseId!} module={m} next={{ href: firstPractice.href }} />
        </div>
      </DemoProvider>
    </div>
  );
}
