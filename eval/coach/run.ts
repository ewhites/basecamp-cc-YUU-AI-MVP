/**
 * Coach evals from the command line.
 *
 *   npm run eval                          # grading + safety, saved to Supabase and eval/reports/
 *   npm run eval -- --dry-run             # validate the datasets and estimate cost, no API calls
 *   npm run eval -- --grading --split test --reps 3
 *   npm run eval -- --safety
 *   npm run eval -- --grading --limit 5 --model claude-sonnet-5-5 --effort high
 *
 * Flags: --grading, --safety (default: both), --split all|test, --reps N, --model ID,
 * --effort low|medium|high, --limit N (first N cases; never passes the gate), --no-db, --dry-run.
 */
import { loadGradingCases, loadSafetyCases, validateDatasets, estimateCost, type DatasetReport } from "../../src/lib/evals/datasets";
import { runGradingEvalWith, runSafetyEvalWith, type EvalRunResult } from "../../src/lib/evals/run";
import { GRADER_EFFORT, GRADER_MODEL } from "../../src/lib/models";

function parseArgs(argv: string[]) {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const [k, inline] = a.slice(2).split("=", 2) as [string, string | undefined];
    if (["split", "reps", "model", "effort", "limit"].includes(k)) {
      const v = inline ?? argv[++i];
      if (v === undefined) throw new Error(`--${k} needs a value`);
      values[k] = v;
    } else flags.add(k);
  }
  return { flags, values };
}

const pct = (x: unknown) => (typeof x === "number" ? `${(x * 100).toFixed(1)}%` : "-");
const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));

function table(rows: string[][]) {
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => (r[i] ?? "").length)));
  for (const [j, r] of rows.entries()) {
    console.log(r.map((c, i) => pad(c, widths[i]!)).join("  "));
    if (j === 0) console.log(widths.map((w) => "-".repeat(w)).join("  "));
  }
}

function printDataset(r: DatasetReport) {
  const g = r.grading;
  console.log("\nGrading set (eval/coach/grading.jsonl)");
  table([
    ["what", "value"],
    ["cases", String(g.cases)],
    ["split", Object.entries(g.bySplit).map(([k, v]) => `${k} ${v}`).join(", ")],
    ["test by studio", Object.entries(g.testByStudio).map(([k, v]) => `${k} ${v}`).join(", ")],
    ["groups", Object.entries(g.byGroup).map(([k, v]) => `${k}: ${v}`).join(", ")],
    ["cases per exercise", Object.entries(g.byExercise).map(([k, v]) => `${k} ${v}`).join(", ")],
    ["labels", `${g.labels} (${g.labelsTrue} true, ${pct(g.trueRate)})`],
    ["test labels true", pct(g.testTrueRate)],
    ["always-fail baseline", pct(g.alwaysFailBaseline)],
  ]);
  console.log("\nLabels per check");
  table([["check", "true", "false"], ...Object.entries(g.perCheck).map(([k, v]) => [k, String(v.true), String(v.false)])]);
  const s = r.safety;
  console.log("\nSafety set (eval/coach/safety.jsonl)");
  table([
    ["what", "value"],
    ["cases", String(s.cases)],
    ["by kind", Object.entries(s.byKind).map(([k, v]) => `${k} ${v}`).join(", ")],
    ["by target", Object.entries(s.byTarget).map(([k, v]) => `${k} ${v}`).join(", ")],
    ["model-judged", String(s.judged)],
  ]);
}

function printGrading(r: EvalRunResult) {
  if (r.error && !Object.keys(r.summary).length) {
    console.log(`\nGrading eval did not run: ${r.error}`);
    return;
  }
  const s = r.summary as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  console.log(`\nGrading eval (${s.model}, effort ${s.effort}, ${s.cases} cases x ${s.reps} reps, prompt ${s.promptVersion})`);
  table([
    ["metric", "value"],
    ["HELD-OUT agreement (gate >= 80%)", pct(s.heldOutAgreement)],
    ["held-out noise floor (+/-)", pct(s.heldOutNoiseFloor)],
    ["dev agreement", pct(s.agreement?.dev)],
    ["overall agreement", pct(s.agreement?.overall)],
    ["always-fail baseline", pct(s.alwaysFailBaseline)],
    ["consistency across reps", pct(s.consistency)],
    ...Object.entries(s.byGroup ?? {}).map(([g, v]) => [`agreement ${g}`, pct((v as { rate: number }).rate)]),
    ["fairness gap", pct(s.fairnessGap)],
    ["needs review (checks)", pct(s.needsReview?.checkRate)],
    ["failed calls", String(s.errors?.length ?? 0)],
    ["cost", `$${Number(s.costUsd ?? 0).toFixed(4)}`],
    ["latency mean / p95", `${s.latencyMs?.mean ?? "-"} ms / ${s.latencyMs?.p95 ?? "-"} ms`],
  ]);
  console.log("\nPer check");
  table([
    ["check", "n", "agree", "TP", "FP", "FN", "TN", "review"],
    ...Object.entries(s.perCheck ?? {}).map(([k, v]) => {
      const p = v as { n: number; agreement: number; tp: number; fp: number; fn: number; tn: number; needsReview: number };
      return [k, String(p.n), pct(p.agreement), String(p.tp), String(p.fp), String(p.fn), String(p.tn), String(p.needsReview)];
    }),
  ]);
  console.log(`\nGate: ${r.passedGate ? "PASSED" : "NOT PASSED"}${s.gate?.reasons?.length ? ` (${s.gate.reasons.join("; ")})` : ""}`);
  console.log(`Saved: run ${r.runId ?? "(not saved)"}, report ${s.report ?? "(not written)"}`);
  if (r.error) console.log(`Note: ${r.error}`);
}

function printSafety(r: EvalRunResult) {
  if (r.error && !Object.keys(r.summary).length) {
    console.log(`\nSafety eval did not run: ${r.error}`);
    return;
  }
  const s = r.summary as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  console.log(`\nSafety eval: ${s.safetyPassed}/${s.safetyTotal} passed (judge ${s.judgeModel})`);
  table([["kind", "passed"], ...Object.entries(s.byKind ?? {}).map(([k, v]) => [k, `${(v as { passed: number }).passed}/${(v as { total: number }).total}`])]);
  for (const f of s.failures ?? []) console.log(`  FAIL ${f.id}: ${f.error ?? f.failed.map((a: { name: string; detail?: string }) => `${a.name}${a.detail ? ` (${a.detail})` : ""}`).join("; ")}`);
  console.log(`\nGate (20/20): ${r.passedGate ? "PASSED" : "NOT PASSED"}. Cost $${Number(s.costUsd ?? 0).toFixed(4)}.`);
  console.log(`Saved: run ${r.runId ?? "(not saved)"}, report ${s.report ?? "(not written)"}`);
  if (r.error) console.log(`Note: ${r.error}`);
}

async function main() {
  const { flags, values } = parseArgs(process.argv.slice(2));
  const unknown = [...flags].filter((f) => !["grading", "safety", "dry-run", "no-db", "help"].includes(f));
  if (unknown.length) throw new Error(`Unknown flag(s): ${unknown.map((f) => `--${f}`).join(", ")}`);
  if (flags.has("help")) {
    console.log("Usage: npm run eval -- [--grading] [--safety] [--split all|test] [--reps N] [--model ID] [--effort low|medium|high] [--limit N] [--no-db] [--dry-run]");
    return 0;
  }
  const both = !flags.has("grading") && !flags.has("safety");
  const doGrading = both || flags.has("grading");
  const doSafety = both || flags.has("safety");
  const split = (values.split ?? "all") as "all" | "test";
  if (!["all", "test"].includes(split)) throw new Error("--split must be all or test");
  const reps = values.reps ? Number(values.reps) : 2;
  if (!Number.isInteger(reps) || reps < 1 || reps > 10) throw new Error("--reps must be a whole number from 1 to 10");
  const effort = (values.effort ?? GRADER_EFFORT) as "low" | "medium" | "high";
  if (!["low", "medium", "high"].includes(effort)) throw new Error("--effort must be low, medium or high");
  const limit = values.limit ? Number(values.limit) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new Error("--limit must be a positive whole number");
  const model = values.model ?? GRADER_MODEL;

  const grading = loadGradingCases();
  const safety = loadSafetyCases();
  const report = validateDatasets(grading, safety);

  if (flags.has("dry-run")) {
    console.log("DRY RUN: validating datasets and estimating cost. No API calls.");
    printDataset(report);
    const gCases = grading.filter((c) => split === "all" || c.split === "test").slice(0, limit);
    const est = estimateCost(doGrading ? gCases : [], doSafety ? safety : [], reps, model);
    console.log("\nEstimated cost (rough: ~4 chars per token, no prompt-cache discount, ~1,500 output tokens per grade)");
    table([
      ["part", "calls", "est. USD"],
      ["grading", `${doGrading ? est.gradingCalls : 0} x ${model}`, `$${est.gradingUsd.toFixed(4)}`],
      ["safety", `${est.safetyGraderCalls} grade + ${est.safetyQaCalls} Q&A + ${est.judgeCalls} judge (Sonnet)`, `$${est.safetyUsd.toFixed(4)}`],
      ["total", "", `$${est.totalUsd.toFixed(4)}`],
    ]);
    for (const w of report.warnings) console.log(`WARN  ${w}`);
    for (const e of report.errors) console.log(`ERROR ${e}`);
    console.log(report.errors.length ? `\nDataset check FAILED: ${report.errors.length} error(s).` : "\nDataset check passed.");
    return report.errors.length ? 1 : 0;
  }

  if (report.errors.length) {
    for (const e of report.errors) console.log(`ERROR ${e}`);
    console.log("Fix the datasets first (npm run eval -- --dry-run).");
    return 1;
  }

  const hooks = { limit, noDb: flags.has("no-db"), onProgress: (l: string) => console.log(l) };
  let ok = true;
  if (doGrading) {
    const r = await runGradingEvalWith({ split, reps, model, effort, trigger: "cli" }, hooks);
    printGrading(r);
    ok &&= r.passedGate;
  }
  if (doSafety) {
    const r = await runSafetyEvalWith({ trigger: "cli" }, hooks);
    printSafety(r);
    ok &&= r.passedGate;
  }
  return ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  },
);
