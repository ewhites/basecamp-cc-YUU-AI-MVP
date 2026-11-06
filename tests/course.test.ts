/** Course map, skills-check tasks and progress rules. */
import { describe, expect, it } from "vitest";
import { ALL_STEPS, COURSE, PASS_MARK } from "../src/lib/curriculum/course";
import { EXERCISES, getExercise } from "../src/lib/curriculum/exercises";
import { SKILL_CHECKS, skillCheck } from "../src/lib/curriculum/skill-checks";
import { SKILLS } from "../src/lib/curriculum/types";
import { coachSystemPrompt } from "../src/lib/coach/prompt";
import { computeProgress, scoreChecks } from "../src/lib/progress-core";

describe("course map", () => {
  it("runs start check, three modules (lesson + 3 practice), then final check and skills", () => {
    expect(COURSE.map((g) => g.id)).toEqual(["start", "M01", "M02", "M03", "finish"]);
    for (const m of ["M01", "M02", "M03"]) {
      const g = COURSE.find((x) => x.id === m)!;
      expect(g.steps.map((s) => s.kind)).toEqual(["lesson", "practice", "practice", "practice"]);
    }
    expect(ALL_STEPS[0]!.id).toBe("check-start");
    expect(ALL_STEPS.at(-1)!.id).toBe("skills");
    expect(new Set(ALL_STEPS.map((s) => s.id)).size).toBe(ALL_STEPS.length);
    // Every practice exercise appears exactly once.
    expect(ALL_STEPS.filter((s) => s.kind === "practice").map((s) => s.exerciseId).sort()).toEqual(EXERCISES.map((e) => e.id).sort());
  });
});

describe("skills check tasks", () => {
  it("has a starting point and a parallel final check: one task per skill, same checks", () => {
    for (const kind of ["start", "final"] as const) {
      const tasks = skillCheck(kind);
      expect(tasks).toHaveLength(4);
      expect(new Set(tasks.flatMap((t) => t.checks.map((c) => c.skill)))).toEqual(new Set(SKILLS));
    }
    const keys = (kind: "start" | "final") => skillCheck(kind).map((t) => t.checks.map((c) => c.key));
    expect(keys("final")).toEqual(keys("start"));
    // Parallel forms: new scenarios, not the same text.
    const text = (t: { scenario: string; material?: { text: string } }) => t.scenario + (t.material?.text ?? "");
    for (const [i, t] of skillCheck("start").entries()) expect(text(skillCheck("final")[i]!)).not.toBe(text(t));
  });

  it("is graded by the coach on the student's own words and builds a valid coach prompt", () => {
    for (const t of SKILL_CHECKS) {
      expect(getExercise(t.id)).toBe(t);
      expect(t.studio).toBe("check");
      for (const c of t.checks) {
        expect(c.method).toBe("coach");
        expect(c.evidenceFrom).toBe("attempt");
      }
      const sys = coachSystemPrompt(t);
      expect(sys).toContain("<student_answer>");
      for (const c of t.checks) expect(sys).toContain(`key: ${c.key}`);
    }
  });
});

describe("progress", () => {
  const passAll = (id: string, passed: number, total: number) => ({ exercise_id: id, status: "scored", passed, total });

  it("a new student starts at the starting point check", () => {
    const p = computeProgress([], new Set());
    expect(p.next?.id).toBe("check-start");
    expect(p.done).toBe(0);
  });

  it("the check counts once all four tasks are answered, whatever the score", () => {
    const three = skillCheck("start").slice(0, 3).map((t) => passAll(t.id, 0, 3));
    expect(computeProgress(three, new Set()).states["check-start"]!.done).toBe(false);
    const four = skillCheck("start").map((t) => passAll(t.id, 0, 3));
    const p = computeProgress(four, new Set());
    expect(p.states["check-start"]!.done).toBe(true);
    expect(p.next?.id).toBe("lesson-M01");
  });

  it(`practice is done when one attempt passes at least ${PASS_MARK * 100}% of its checks`, () => {
    const lessons = new Set(["lesson-M01"]);
    const start = skillCheck("start").map((t) => passAll(t.id, 1, 3));
    const weak = computeProgress([...start, passAll("ps-ticket-summary", 4, 7)], lessons);
    expect(weak.states["ps-ticket-summary"]).toMatchObject({ started: true, done: false, best: { passed: 4, total: 7 } });
    expect(weak.next?.id).toBe("ps-ticket-summary");
    const strong = computeProgress([...start, passAll("ps-ticket-summary", 4, 7), passAll("ps-ticket-summary", 6, 7)], lessons);
    expect(strong.states["ps-ticket-summary"]!.done).toBe(true);
    expect(strong.next?.id).toBe("ps-meeting-recap");
  });

  it("scores the starting point and final check per skill", () => {
    const rows = [
      { exercise_id: "sp-describe", skill: "description", pass: true },
      { exercise_id: "sp-describe", skill: "description", pass: false },
      { exercise_id: "fc-describe", skill: "description", pass: true },
    ];
    expect(scoreChecks(rows, "start").description).toBe(0.5);
    expect(scoreChecks(rows, "final").description).toBe(1);
    expect(scoreChecks(rows, "start").discernment).toBeNull();
  });
});
