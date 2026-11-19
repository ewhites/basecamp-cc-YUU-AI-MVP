import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Progress } from "@/design/Progress";
import { Sheet } from "@/design/Sheet";
import { Crumbs, Panel, Section } from "@/design/Structure";
import { COURSE, MODULE_INFO, moduleBySlug } from "@/lib/curriculum/course";
import { lessonFor } from "@/lib/curriculum/lessons";
import { myProgress } from "@/lib/progress";
import { requireRole } from "@/lib/session";
import { exampleOpenByDefault, readIntro } from "../../intro";
import { orderedPractice } from "../../practice/order";
import { Split } from "../../practice/Frame";
import { DemoProvider, LessonCoach, WorkedExample } from "../Demo";
import { FadedExample } from "../FadedExample";
import { StartPractice } from "../StartPractice";

/** A module's 5-minute lesson: the worked example first (with an optional demo), your turn, the rule, then Start practice. */
export default async function LessonPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
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
  // Module 3 goes through its scripted demos before the live build.
  const up = group.steps.find((s) => s.kind === "demo") ?? firstPractice;
  const progress = await myProgress();
  const doneInModule = group.steps.filter(
    (s) => progress.states[s.id]?.done,
  ).length;
  const { worked } = lesson;

  return (
    <div className="ds-page ln-page">
      <Crumbs
        items={[
          { label: "Home", href: "/lab" },
          { label: `Module ${info.number}: ${info.title}` },
        ]}
      />
      <Progress
        className="ln-where ds-rise"
        label={info.title}
        value={doneInModule / group.steps.length}
        end={`Lesson, ${lessonStep.minutes} min`}
      />
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
            title={info.lessonTitle}
            actions={
              <>
                <span className="ln-foot-line">Up next: {up.title}</span>
                <StartPractice
                  stepId={lessonStep.id}
                  href={up.href}
                  label={up.kind === "demo" ? "Watch first demo" : undefined}
                  pendingLabel={up.kind === "demo" ? "Opening demo" : undefined}
                />
              </>
            }
          >
            <Split
              a={
                <>
                  <Section title="The idea" id="idea">
                    <Panel>
                      <p className="ln-read">{lesson.intro}</p>
                    </Panel>
                  </Section>

                  <WorkedExample openByDefault={exampleOpenByDefault(intro)} />
                </>
              }
              b={
                <>
                  <Section title="Your turn" id="your-turn">
                    <FadedExample faded={lesson.faded} parts={lesson.parts} />
                  </Section>

                  <Section title="The rule" id="rule">
                    <Panel list>
                      <ol className="ds-rows ln-rule">
                        {lesson.recap.map((line) => (
                          <li key={line} className="ds-row">
                            {line}
                          </li>
                        ))}
                      </ol>
                    </Panel>
                  </Section>
                </>
              }
            />
          </Sheet>
          <LessonCoach
            exerciseId={firstPractice.exerciseId!}
            module={m}
            next={{ href: up.href, title: up.title }}
          />
        </div>
      </DemoProvider>
    </div>
  );
}
