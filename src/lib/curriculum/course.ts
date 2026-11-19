import { DEMOS } from "../sandbox/demos";
import { EXERCISES } from "./exercises";
import type { Competency, ModuleId } from "./types";

/**
 * The course map: the order a student moves through the Lab, shown as the syllabus.
 * Start here (starting point check) -> Module 1 -> Module 2 -> Module 3 -> Finish (final check, skills).
 * Each module opens with a short lesson (a worked example first), then practice tasks.
 * Module 3 (Building an agent) is different: the lesson, two scripted demos (research assistant, travel planner),
 * then one live build (the New-hire IT helper bot). The two other agent exercises stay in EXERCISES for the
 * coach eval datasets, which refer to them, but are not on the course map.
 */

export type StepKind = "check" | "lesson" | "demo" | "practice" | "skills";

export interface CourseStep {
  id: string;
  kind: StepKind;
  title: string;
  minutes: number;
  href: string;
  /** Practice steps: the exercise. Check steps: "start" | "final". */
  exerciseId?: string;
  checkKind?: "start" | "final";
  module?: ModuleId;
}

export interface CourseGroup {
  id: string;
  title: string;
  /** One line under the module title. */
  blurb?: string;
  module?: ModuleId;
  steps: CourseStep[];
}

/** skill: the main coached skill. competency: the curriculum competency the module maps to (lesson-to-competency mapping). */
export const MODULE_INFO: Record<ModuleId, { slug: string; number: number; title: string; skill: string; competency: Competency; lessonTitle: string; blurb: string }> = {
  M01: { slug: "m1", number: 1, title: "Writing prompts", skill: "Prompting", competency: "Generative AI", lessonTitle: "The R-T-G pattern", blurb: "Tell the AI exactly what you need." },
  M02: { slug: "m2", number: 2, title: "Comparing models", skill: "Comparing models", competency: "Generative AI Applications", lessonTitle: "Fit, Trust, Cost", blurb: "Run one prompt on three models and judge which did best." },
  M03: { slug: "m3", number: 3, title: "Building an agent", skill: "Context engineering", competency: "Agentic AI", lessonTitle: "The four-part agent spec", blurb: "Give an agent a job, tools and limits, then test it." },
};

export function moduleBySlug(slug: string): ModuleId | undefined {
  return (Object.keys(MODULE_INFO) as ModuleId[]).find((m) => MODULE_INFO[m].slug === slug);
}

const PRACTICE_MINUTES = { prompt: 8, arena: 10, agent: 10, check: 3 } as const;

/** Exercises that exist for the eval datasets but are not on the course map. */
export const OFF_MAP_EXERCISES: readonly string[] = ["ab-room-booking", "ab-expense-policy"];

function moduleGroup(m: ModuleId): CourseGroup {
  const info = MODULE_INFO[m];
  return {
    id: m,
    module: m,
    title: `Module ${info.number}: ${info.title}`,
    blurb: info.blurb,
    steps: [
      { id: `lesson-${m}`, kind: "lesson", title: info.lessonTitle, minutes: 5, href: `/lab/lesson/${info.slug}`, module: m },
      ...(m === "M03"
        ? DEMOS.map((d) => ({ id: d.id, kind: "demo" as const, title: d.title, minutes: d.minutes, href: `/lab/lesson/${info.slug}/${d.slug}`, module: m }))
        : []),
      ...EXERCISES.filter((e) => e.module === m && !OFF_MAP_EXERCISES.includes(e.id)).map((e) => ({
        id: e.id,
        kind: "practice" as const,
        title: e.title,
        minutes: PRACTICE_MINUTES[e.studio],
        href: `/lab/practice/${e.id}`,
        exerciseId: e.id,
        module: m,
      })),
    ],
  };
}

export const COURSE: CourseGroup[] = [
  {
    id: "start",
    title: "Start here",
    steps: [{ id: "check-start", kind: "check", title: "Starting point check", minutes: 10, href: "/lab/check/start", checkKind: "start" }],
  },
  moduleGroup("M01"),
  moduleGroup("M02"),
  moduleGroup("M03"),
  {
    id: "finish",
    title: "Finish",
    steps: [
      { id: "check-final", kind: "check", title: "Final check", minutes: 10, href: "/lab/check/final", checkKind: "final" },
      { id: "skills", kind: "skills", title: "Your skills", minutes: 2, href: "/lab/skills" },
    ],
  },
];

export const ALL_STEPS: CourseStep[] = COURSE.flatMap((g) => g.steps);

/** A practice task counts as done once one attempt passes at least this share of its checks. */
export const PASS_MARK = 0.8;

export function stepFor(id: string): CourseStep | undefined {
  return ALL_STEPS.find((s) => s.id === id);
}
