import { ALL_STEPS, COURSE, type CourseStep } from "@/lib/curriculum/course";
import { getExercise } from "@/lib/curriculum/exercises";
import type { ModuleId } from "@/lib/curriculum/types";
import { trackFirst, type Intro } from "../intro";

/**
 * Presentation order of a module's practice tasks: tasks of the student's chosen kind of work come first
 * (first-visit answer, src/app/lab/intro.ts). The course data in src/lib is not changed.
 */
export function orderedPractice(module: ModuleId, intro: Intro | null): CourseStep[] {
  const group = COURSE.find((g) => g.module === module);
  const practice = (group?.steps ?? []).filter((s) => s.kind === "practice");
  const withTrack = practice.map((s) => ({ step: s, track: getExercise(s.exerciseId ?? "")?.track ?? "" }));
  return trackFirst(withTrack, intro).map((x) => x.step);
}

/** The step after a practice task, in the order the student sees: the next task in the module, else what follows the module. */
export function nextAfterPractice(module: ModuleId, stepId: string, intro: Intro | null): { title: string; href: string } | null {
  const ordered = orderedPractice(module, intro);
  const at = ordered.findIndex((s) => s.id === stepId);
  const inModule = ordered[at + 1];
  if (inModule) return { title: inModule.title, href: inModule.href };
  const group = COURSE.find((g) => g.module === module);
  const last = group?.steps[group.steps.length - 1];
  const after = last ? ALL_STEPS[ALL_STEPS.findIndex((s) => s.id === last.id) + 1] : undefined;
  return after ? { title: after.title, href: after.href } : null;
}
