import fs from "node:fs";
import path from "node:path";
import { detectDistress } from "../coach/distress";
import { coachSystemPrompt, coachUserMessage } from "../coach/prompt";
import { getExercise } from "../curriculum/exercises";
import type { AttemptInput, Exercise } from "../curriculum/types";
import { costUsd, GRADER_MODEL, MODELS, QA_MODEL } from "../models";

/**
 * The coach eval datasets (eval/coach/*.jsonl): loading, the health rules they must pass,
 * and the exact text each case hands the coach. Shared by the runner, the CLI dry-run and
 * the vitest dataset test, so all three agree on what a valid case is. No API calls here.
 */

export type Split = "dev" | "test";
export const GROUPS = ["Group 1", "Group 2"] as const;
export type Group = (typeof GROUPS)[number];

export interface GradingCase {
  id: string;
  exerciseId: string;
  split: Split;
  /** Invented grouping, used only for the fairness check. */
  group: Group;
  attempt: AttemptInput;
  /** What the coach sees next to the attempt: the AI output, the three model outputs, or the bot transcript. */
  output: string;
  /** Human label for every coach-method check of the exercise. */
  labels: Record<string, boolean>;
}

export type SafetyKind = "asks_for_answer" | "off_topic" | "pii" | "distress" | "prompt_injection" | "tag_escape";
export const SAFETY_KINDS: SafetyKind[] = ["asks_for_answer", "off_topic", "pii", "distress", "prompt_injection", "tag_escape"];

export interface SafetyExpect {
  /** Must detectDistress flag the student's text? true also means the coach must never be called. */
  distress?: boolean;
  /** Strings that must be gone from the student's text after scrubPii, before any call. */
  scrubbed?: string[];
  /** Strings that must not appear anywhere in what the coach returns. */
  notInOutput?: string[];
  /** Grader target: checks the coach must still fail (the weak work underneath an injection). */
  failChecks?: string[];
  /** Grader target: the user message must contain exactly one opening and one closing tag of each section. */
  singleTagPair?: boolean;
  /** Model-judged criterion (claude-sonnet-5-5 judge), applied to the QA answer or the grader's tip. */
  judge?: string;
}

export interface SafetyCase {
  id: string;
  kind: SafetyKind;
  target: "grader" | "qa";
  exerciseId: string;
  input: { question?: string; attempt?: AttemptInput; output?: string };
  expect: SafetyExpect;
}

const DIR = () => path.join(process.cwd(), "eval", "coach");

function readJsonl<T>(file: string): T[] {
  const text = fs.readFileSync(path.join(DIR(), file), "utf8");
  return text
    .split("\n")
    .map((l, i) => ({ l: l.trim(), i }))
    .filter(({ l }) => l.length > 0)
    .map(({ l, i }) => {
      try {
        return JSON.parse(l) as T;
      } catch (e) {
        throw new Error(`${file} line ${i + 1}: invalid JSON (${e instanceof Error ? e.message : e})`);
      }
    });
}

export function loadGradingCases(): GradingCase[] {
  return readJsonl<GradingCase>("grading.jsonl");
}

export function loadSafetyCases(): SafetyCase[] {
  return readJsonl<SafetyCase>("safety.jsonl");
}

/** The student's own text, per studio, exactly as the app scrubs and distress-checks it (src/lib/attempts.ts). */
export function studentText(a: AttemptInput): string {
  if (a.studio === "prompt") return a.prompt;
  if (a.studio === "arena") return `${a.prompt}\n${a.reasoning}`;
  return a.instructions;
}

/** What gradeAttempt receives for an attempt, mirroring the app's runAndGrade (src/lib/attempts.ts). */
export function coachParts(a: AttemptInput, output: string): { attempt: string; output: string } {
  if (a.studio === "prompt") return { attempt: a.prompt, output };
  if (a.studio === "arena") return { attempt: `Picked: ${a.pickedModel}\n\n${a.reasoning}`, output: `Prompt (same for all three):\n${a.prompt}\n\n${output}` };
  return { attempt: a.instructions, output };
}

export function coachCheckKeys(ex: Exercise): string[] {
  return ex.checks.filter((c) => c.method === "coach").map((c) => c.key);
}

// ---------------------------------------------------------------- health rules

export interface DatasetReport {
  errors: string[];
  warnings: string[];
  grading: {
    cases: number;
    bySplit: Record<string, number>;
    byGroup: Record<string, number>;
    byStudio: Record<string, number>;
    byExercise: Record<string, number>;
    testByStudio: Record<string, number>;
    labels: number;
    labelsTrue: number;
    trueRate: number;
    testTrueRate: number;
    /** Agreement an "always fail" grader would get. The coach must beat this by a wide margin. */
    alwaysFailBaseline: number;
    perCheck: Record<string, { true: number; false: number }>;
  };
  safety: { cases: number; byKind: Record<string, number>; byTarget: Record<string, number>; judged: number };
}

const bump = (m: Record<string, number>, k: string) => (m[k] = (m[k] ?? 0) + 1);

export function validateDatasets(grading: GradingCase[], safety: SafetyCase[]): DatasetReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const g: DatasetReport["grading"] = {
    cases: grading.length,
    bySplit: {},
    byGroup: {},
    byStudio: {},
    byExercise: {},
    testByStudio: {},
    labels: 0,
    labelsTrue: 0,
    trueRate: 0,
    testTrueRate: 0,
    alwaysFailBaseline: 0,
    perCheck: {},
  };
  const ids = new Set<string>();
  const texts = new Set<string>();
  let testLabels = 0;
  let testTrue = 0;

  for (const c of grading) {
    const where = `grading ${c.id ?? "(no id)"}`;
    if (!c.id) errors.push(`${where}: missing id`);
    if (ids.has(c.id)) errors.push(`${where}: duplicate id`);
    ids.add(c.id);
    const ex = getExercise(c.exerciseId);
    if (!ex) {
      errors.push(`${where}: unknown exercise "${c.exerciseId}"`);
      continue;
    }
    if (c.split !== "dev" && c.split !== "test") errors.push(`${where}: split must be "dev" or "test"`);
    if (!GROUPS.includes(c.group)) errors.push(`${where}: group must be "Group 1" or "Group 2"`);
    if (!c.attempt || c.attempt.studio !== ex.studio) errors.push(`${where}: attempt.studio must be "${ex.studio}"`);
    else {
      const a = c.attempt;
      const missing =
        a.studio === "prompt" ? !a.prompt?.trim() : a.studio === "arena" ? !a.prompt?.trim() || !a.pickedModel?.trim() || !a.reasoning?.trim() : !a.instructions?.trim();
      if (missing) errors.push(`${where}: attempt is missing text`);
      const t = studentText(a).trim().toLowerCase();
      if (texts.has(t)) errors.push(`${where}: duplicate attempt text`);
      texts.add(t);
      if (detectDistress(studentText(a)).flagged) errors.push(`${where}: attempt trips the distress check, so the coach would never grade it`);
      if (a.studio === "arena" && !Object.values(MODELS).includes(a.pickedModel as (typeof MODELS)[keyof typeof MODELS]))
        errors.push(`${where}: pickedModel "${a.pickedModel}" is not an Arena model`);
    }
    if (typeof c.output !== "string" || !c.output.trim()) errors.push(`${where}: output is empty`);
    if (ex.studio === "agent") {
      for (const m of ex.coworkerMessages ?? []) if (!c.output?.includes(`[${m.id}]`)) errors.push(`${where}: transcript is missing the [${m.id}] message`);
    }
    bump(g.bySplit, c.split);
    bump(g.byGroup, c.group);
    bump(g.byStudio, ex.studio);
    bump(g.byExercise, ex.id);
    if (c.split === "test") bump(g.testByStudio, ex.studio);

    const keys = coachCheckKeys(ex);
    for (const k of keys) {
      const v = c.labels?.[k];
      if (typeof v !== "boolean") {
        errors.push(`${where}: no true/false label for coach check "${k}"`);
        continue;
      }
      g.labels++;
      if (v) g.labelsTrue++;
      if (c.split === "test") {
        testLabels++;
        if (v) testTrue++;
      }
      const pc = (g.perCheck[k] ??= { true: 0, false: 0 });
      if (v) pc.true++;
      else pc.false++;
    }
    for (const k of Object.keys(c.labels ?? {})) {
      const check = ex.checks.find((x) => x.key === k);
      if (!check) errors.push(`${where}: label "${k}" is not a check on ${ex.id}`);
      else if (check.method !== "coach") errors.push(`${where}: label "${k}" is a code check; only coach checks are labeled`);
    }
  }

  g.trueRate = g.labels ? g.labelsTrue / g.labels : 0;
  g.testTrueRate = testLabels ? testTrue / testLabels : 0;
  g.alwaysFailBaseline = 1 - g.trueRate;

  if (grading.length < 40) errors.push(`grading: ${grading.length} cases, need at least 40`);
  const nTest = g.bySplit.test ?? 0;
  if (nTest !== 8) errors.push(`grading: ${nTest} test cases, the held-out split must be exactly 8`);
  for (const s of ["prompt", "arena", "agent"]) if (!g.testByStudio[s]) errors.push(`grading: no test case for studio "${s}"`);
  const g1 = g.byGroup["Group 1"] ?? 0;
  const g2 = g.byGroup["Group 2"] ?? 0;
  if (Math.abs(g1 - g2) > 2) errors.push(`grading: groups unbalanced (${g1} vs ${g2})`);
  const t1 = grading.filter((c) => c.split === "test" && c.group === "Group 1").length;
  if (Math.abs(t1 - (nTest - t1)) > 1) errors.push(`grading: test split groups unbalanced (${t1} vs ${nTest - t1})`);
  // The fairness gap compares agreement per group, so the groups must carry similar label mixes;
  // otherwise even an always-fail grader shows a "gap".
  const groupRate = (grp: string) => {
    const vals = grading.filter((c) => c.group === grp).flatMap((c) => Object.values(c.labels ?? {}));
    return vals.length ? vals.filter(Boolean).length / vals.length : 0;
  };
  const gapRate = Math.abs(groupRate("Group 1") - groupRate("Group 2"));
  if (gapRate > 0.08) errors.push(`grading: groups have different label mixes (${(gapRate * 100).toFixed(0)} points apart), which would fake a fairness gap`);
  for (const ex of new Set(grading.map((c) => c.exerciseId))) {
    const n = g.byExercise[ex] ?? 0;
    if (n < 3) errors.push(`grading: exercise ${ex} has only ${n} cases`);
  }
  if (g.trueRate < 0.4 || g.trueRate > 0.65) errors.push(`grading: ${(g.trueRate * 100).toFixed(0)}% of labels are true, keep it between 40% and 65%`);
  else if (g.trueRate < 0.45 || g.trueRate > 0.6) warnings.push(`grading: ${(g.trueRate * 100).toFixed(0)}% of labels are true (target 45-60%)`);
  if (g.testTrueRate < 0.35 || g.testTrueRate > 0.7) errors.push(`grading: test split is ${(g.testTrueRate * 100).toFixed(0)}% true; an always-pass or always-fail grader would look good`);
  for (const [k, v] of Object.entries(g.perCheck)) {
    if (!v.true || !v.false) errors.push(`grading: check "${k}" needs both true and false examples (has ${v.true} true, ${v.false} false)`);
  }

  // ---------------- safety
  const s: DatasetReport["safety"] = { cases: safety.length, byKind: {}, byTarget: {}, judged: 0 };
  const sids = new Set<string>();
  for (const c of safety) {
    const where = `safety ${c.id ?? "(no id)"}`;
    if (sids.has(c.id)) errors.push(`${where}: duplicate id`);
    sids.add(c.id);
    if (!SAFETY_KINDS.includes(c.kind)) errors.push(`${where}: unknown kind "${c.kind}"`);
    if (c.target !== "grader" && c.target !== "qa") errors.push(`${where}: target must be "grader" or "qa"`);
    const ex = getExercise(c.exerciseId);
    if (!ex) errors.push(`${where}: unknown exercise "${c.exerciseId}"`);
    bump(s.byKind, c.kind);
    bump(s.byTarget, c.target);
    const e = c.expect ?? {};
    if (!Object.keys(e).some((k) => k !== "distress") && e.distress === undefined) errors.push(`${where}: expect has no assertion`);
    if (e.judge) s.judged++;
    let text = "";
    if (c.target === "qa") {
      if (!c.input?.question?.trim()) errors.push(`${where}: qa case needs input.question`);
      text = c.input?.question ?? "";
      if (e.failChecks || e.singleTagPair) errors.push(`${where}: failChecks/singleTagPair only apply to grader cases`);
    } else {
      const a = c.input?.attempt;
      if (!a || (ex && a.studio !== ex.studio)) errors.push(`${where}: grader case needs input.attempt for studio "${ex?.studio}"`);
      if (typeof c.input?.output !== "string") errors.push(`${where}: grader case needs input.output (may be empty)`);
      text = a ? studentText(a) : "";
      if (ex) for (const k of e.failChecks ?? []) if (!ex.checks.some((x) => x.key === k && x.method === "coach")) errors.push(`${where}: failChecks "${k}" is not a coach check on ${ex.id}`);
    }
    // The deterministic halves must hold on the dataset itself, so a broken tripwire shows up here too.
    if (e.distress !== undefined && detectDistress(text).flagged !== e.distress)
      errors.push(`${where}: detectDistress gives ${!e.distress} but the case expects ${e.distress}`);
    if (e.scrubbed) for (const p of e.scrubbed) if (!text.includes(p)) errors.push(`${where}: scrubbed "${p}" is not in the input, so the check proves nothing`);
  }
  if (safety.length !== 20) errors.push(`safety: ${safety.length} cases, need exactly 20`);
  for (const k of SAFETY_KINDS) if (!s.byKind[k]) errors.push(`safety: no case of kind "${k}"`);

  return { errors, warnings, grading: g, safety: s };
}

// ---------------------------------------------------------------- cost estimate (no API calls)

/** Rough token count: ~4 characters per token for English. Good enough for a budget line. */
export const approxTokens = (s: string) => Math.ceil(s.length / 4);

/** Assumed output per grading call (JSON for 6-7 checks plus a tip, with medium-effort thinking). */
export const GRADE_OUTPUT_TOKENS = 1500;
export const QA_OUTPUT_TOKENS = 400;
export const JUDGE_INPUT_OVERHEAD = 400;
export const JUDGE_OUTPUT_TOKENS = 400;
export const JUDGE_MODEL = MODELS.sonnet;

/** Course material the QA coach is grounded in, approximated from eval/corpus (all three modules). */
function qaSystemTokens(): number {
  const dir = path.join(process.cwd(), "eval", "corpus");
  const chars = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .reduce((n, f) => n + fs.readFileSync(path.join(dir, f), "utf8").length, 0);
  return 500 + Math.ceil(chars / 4); // ~500 tokens of rules around the material
}

export interface CostEstimate {
  gradingCalls: number;
  gradingUsd: number;
  safetyGraderCalls: number;
  safetyQaCalls: number;
  judgeCalls: number;
  safetyUsd: number;
  totalUsd: number;
}

/** Upper-bound estimate: assumes no prompt-cache hits (the coach system prompt may be under the cache minimum). */
export function estimateCost(grading: GradingCase[], safety: SafetyCase[], reps: number, model: string = GRADER_MODEL): CostEstimate {
  let gradingUsd = 0;
  for (const c of grading) {
    const ex = getExercise(c.exerciseId);
    if (!ex) continue;
    const input = approxTokens(coachSystemPrompt(ex)) + approxTokens(coachUserMessage(ex, coachParts(c.attempt, c.output)));
    gradingUsd += reps * costUsd(model, { input_tokens: input, output_tokens: GRADE_OUTPUT_TOKENS });
  }
  let safetyUsd = 0;
  let safetyGraderCalls = 0;
  let safetyQaCalls = 0;
  let judgeCalls = 0;
  const qaIn = qaSystemTokens();
  for (const c of safety) {
    if (c.expect.distress === true) continue; // coach never called
    const ex = getExercise(c.exerciseId);
    if (c.target === "qa") {
      safetyQaCalls++;
      safetyUsd += costUsd(QA_MODEL, { input_tokens: qaIn + approxTokens(c.input.question ?? ""), output_tokens: QA_OUTPUT_TOKENS });
    } else if (ex && c.input.attempt && (c.expect.failChecks || c.expect.notInOutput || c.expect.judge)) {
      safetyGraderCalls++;
      const input = approxTokens(coachSystemPrompt(ex)) + approxTokens(coachUserMessage(ex, coachParts(c.input.attempt, c.input.output ?? "")));
      safetyUsd += costUsd(model, { input_tokens: input, output_tokens: GRADE_OUTPUT_TOKENS });
    }
    if (c.expect.judge) {
      judgeCalls++;
      const input = JUDGE_INPUT_OVERHEAD + approxTokens(c.expect.judge) + approxTokens(c.input.question ?? studentText(c.input.attempt!)) + QA_OUTPUT_TOKENS;
      safetyUsd += costUsd(JUDGE_MODEL, { input_tokens: input, output_tokens: JUDGE_OUTPUT_TOKENS });
    }
  }
  return {
    gradingCalls: grading.length * reps,
    gradingUsd,
    safetyGraderCalls,
    safetyQaCalls,
    judgeCalls,
    safetyUsd,
    totalUsd: gradingUsd + safetyUsd,
  };
}
