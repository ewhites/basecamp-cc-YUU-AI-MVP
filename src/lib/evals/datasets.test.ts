import { describe, expect, it } from "vitest";
import { detectDistress } from "../coach/distress";
import { scrubPii } from "../coach/privacy";
import { coachUserMessage } from "../coach/prompt";
import { getExercise } from "../curriculum/exercises";
import { coachCheckKeys, coachParts, estimateCost, loadGradingCases, loadSafetyCases, studentText, validateDatasets } from "./datasets";

/** Dataset health rules for the coach evals. No API calls. */
const grading = loadGradingCases();
const safety = loadSafetyCases();
const report = validateDatasets(grading, safety);

describe("coach eval datasets", () => {
  it("pass every health rule", () => {
    expect(report.errors).toEqual([]);
  });

  it("grading set: 40+ cases over all 9 exercises, 8 held-out spread over all three studios", () => {
    expect(grading.length).toBeGreaterThanOrEqual(40);
    expect(Object.keys(report.grading.byExercise)).toHaveLength(9);
    expect(report.grading.bySplit.test).toBe(8);
    expect(Object.keys(report.grading.testByStudio).sort()).toEqual(["agent", "arena", "prompt"]);
  });

  it("labels every coach check (and only coach checks) on every case", () => {
    for (const c of grading) {
      const ex = getExercise(c.exerciseId)!;
      expect(Object.keys(c.labels).sort(), c.id).toEqual(coachCheckKeys(ex).sort());
    }
  });

  it("is balanced: groups, label rate, and both outcomes for every check", () => {
    expect(Math.abs((report.grading.byGroup["Group 1"] ?? 0) - (report.grading.byGroup["Group 2"] ?? 0))).toBeLessThanOrEqual(2);
    expect(report.grading.trueRate).toBeGreaterThanOrEqual(0.45);
    expect(report.grading.trueRate).toBeLessThanOrEqual(0.6);
    for (const [k, v] of Object.entries(report.grading.perCheck)) {
      expect(v.true, `${k} true`).toBeGreaterThan(0);
      expect(v.false, `${k} false`).toBeGreaterThan(0);
    }
  });

  it("no grading attempt trips the distress tripwire", () => {
    for (const c of grading) expect(detectDistress(studentText(c.attempt)).flagged, c.id).toBe(false);
  });

  it("safety set: 20 cases covering every kind, and the deterministic halves hold", () => {
    expect(safety).toHaveLength(20);
    for (const c of safety) {
      const text = c.target === "qa" ? c.input.question! : studentText(c.input.attempt!);
      if (c.expect.distress !== undefined) expect(detectDistress(text).flagged, c.id).toBe(c.expect.distress);
      for (const p of c.expect.scrubbed ?? []) {
        expect(text, `${c.id} has the PII`).toContain(p);
        expect(scrubPii(text).text, `${c.id} scrubs ${p}`).not.toContain(p);
      }
    }
  });

  it("tag-escape cases cannot close the coach's section tags", () => {
    for (const c of safety.filter((x) => x.expect.singleTagPair)) {
      const ex = getExercise(c.exerciseId)!;
      const msg = coachUserMessage(ex, coachParts(c.input.attempt!, c.input.output ?? ""));
      const closes = (msg.match(/<\/(student_prompt|student_reasoning|bot_instructions|ai_output|model_outputs|bot_transcript)>/g) ?? []).length;
      expect(closes, c.id).toBe(2);
    }
  });

  it("estimates a full run at well under a dollar", () => {
    const est = estimateCost(grading, safety, 2);
    expect(est.gradingCalls).toBe(80);
    expect(est.totalUsd).toBeGreaterThan(0);
    expect(est.totalUsd).toBeLessThan(1);
  });
});
