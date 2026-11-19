import { notFound } from "next/navigation";
import { Progress } from "@/design/Progress";
import { ALL_STEPS, COURSE, MODULE_INFO, moduleBySlug } from "@/lib/curriculum/course";
import { myProgress } from "@/lib/progress";
import { DEMOS, demoBySlug } from "@/lib/sandbox/demos";
import { SANDBOX_EXERCISE } from "@/lib/sandbox/tools";
import { requireRole } from "@/lib/session";
import { SandboxDemo } from "./SandboxDemo";

/** A scripted agent demo in Module 3: where you are, the agent's steps and the four tool panels, the coach beside it. */
export default async function DemoPage({ params }: { params: Promise<{ module: string; demo: string }> }) {
  await requireRole("student");
  const { module: slug, demo: demoSlug } = await params;
  const m = moduleBySlug(slug);
  const demo = demoBySlug(demoSlug);
  const group = COURSE.find((g) => g.module === m);
  const step = group?.steps.find((s) => s.id === demo?.id);
  if (!m || !demo || !group || !step) notFound();

  const progress = await myProgress();
  const doneInModule = group.steps.filter((s) => progress.states[s.id]?.done).length;
  const after = ALL_STEPS[ALL_STEPS.findIndex((s) => s.id === step.id) + 1];
  const n = DEMOS.findIndex((d) => d.id === demo.id) + 1;

  return (
    <div className="ds-page ln-page">
      <Progress className="ln-where ds-rise" label={MODULE_INFO[m].title} value={doneInModule / group.steps.length} end={`Demo ${n} of ${DEMOS.length}`} />
      <SandboxDemo
        key={demo.id}
        demo={demo}
        where={`Demo ${n} of ${DEMOS.length}`}
        next={after ? { title: after.title, href: after.href } : null}
        coachExerciseId={SANDBOX_EXERCISE}
      />
    </div>
  );
}
