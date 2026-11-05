import { ALL_STEPS, COURSE, PASS_MARK, type CourseStep } from "./curriculum/course";
import { skillCheck } from "./curriculum/skill-checks";
import { SKILLS, type Skill } from "./curriculum/types";

/** Course progress rules (pure, unit-tested). Reads live in progress.ts. */

export interface StepState {
  done: boolean;
  started: boolean;
  /** Practice: best attempt so far. */
  best?: { passed: number; total: number };
}

export interface Progress {
  states: Record<string, StepState>;
  /** The first step not done yet (the one "Up next" action). Null when everything is done. */
  next: CourseStep | null;
  done: number;
  total: number;
}

export type AttemptRow = { exercise_id: string; status: string; passed: number | null; total: number | null };

export function computeProgress(attempts: AttemptRow[], lessonsDone: Set<string>): Progress {
  const byEx = new Map<string, AttemptRow[]>();
  for (const a of attempts) byEx.set(a.exercise_id, [...(byEx.get(a.exercise_id) ?? []), a]);

  const states: Record<string, StepState> = {};
  for (const step of ALL_STEPS) {
    if (step.kind === "lesson") {
      states[step.id] = { done: lessonsDone.has(step.id), started: lessonsDone.has(step.id) };
    } else if (step.kind === "practice") {
      const rows = byEx.get(step.exerciseId!) ?? [];
      const scored = rows.filter((r) => r.passed !== null && r.total);
      const best = scored.sort((a, b) => b.passed! / b.total! - a.passed! / a.total!)[0];
      states[step.id] = {
        started: rows.length > 0,
        done: !!best && best.passed! / best.total! >= PASS_MARK,
        best: best ? { passed: best.passed!, total: best.total! } : undefined,
      };
    } else if (step.kind === "check") {
      const tasks = skillCheck(step.checkKind!);
      const answered = tasks.filter((t) => (byEx.get(t.id) ?? []).length > 0).length;
      states[step.id] = { started: answered > 0, done: answered === tasks.length };
    }
  }
  const finalDone = states["check-final"]?.done ?? false;
  states["skills"] = { started: finalDone, done: finalDone };

  const order = COURSE.flatMap((g) => g.steps);
  return {
    states,
    next: order.find((s) => !states[s.id]?.done) ?? null,
    done: order.filter((s) => states[s.id]?.done).length,
    total: order.length,
  };
}

/** Per-skill share of checks passed on the starting point and the final check (null = not taken). */
export type SkillScores = Record<Skill, number | null>;

export function scoreChecks(rows: { exercise_id: string; skill: string; pass: boolean }[], kind: "start" | "final"): SkillScores {
  const ids = new Set(skillCheck(kind).map((e) => e.id));
  const out = {} as SkillScores;
  for (const s of SKILLS) {
    const mine = rows.filter((r) => ids.has(r.exercise_id) && r.skill === s);
    out[s] = mine.length ? mine.filter((r) => r.pass).length / mine.length : null;
  }
  return out;
}
