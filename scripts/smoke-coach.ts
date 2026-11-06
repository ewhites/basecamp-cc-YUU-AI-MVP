/**
 * Live smoke test of the coach: the demo's weak and improved Prompt Studio attempts.
 * 4 Haiku calls (run + grade, twice), well under one cent. Usage: npx tsx scripts/smoke-coach.ts [low|medium]
 */
import { gradeAttempt } from "../src/lib/coach/grade";
import { runStudentPrompt } from "../src/lib/coach/runner";
import { getExercise } from "../src/lib/curriculum/exercises";

try {
  if (!process.env.ANTHROPIC_API_KEY) process.loadEnvFile(".env.local");
} catch {
  /* no env file: the SDK reports the missing key */
}

const effort = (process.argv[2] as "low" | "medium" | undefined) ?? undefined;
const ex = getExercise("ps-ticket-summary")!;
const attempts = [
  "You are a help-desk lead. Summarize the ticket below for the next-shift technician. Use only the ticket text and don't guess. Leave out names, phone numbers and employee IDs.",
  "You are a help-desk lead. Summarize the ticket below for the next-shift technician in 5 bullet points under 80 words: problem, what was tried, current status, next step. Use only the ticket text and don't guess. Leave out names, phone numbers and employee IDs.",
];

for (const [i, prompt] of attempts.entries()) {
  const t0 = Date.now();
  const run = await runStudentPrompt(prompt, ex);
  const t1 = Date.now();
  const g = await gradeAttempt({ exercise: ex, attempt: prompt, output: run.text, effort });
  const t2 = Date.now();
  console.log(`\nAttempt ${i + 1}: ${g.passed}/${g.total}  run ${t1 - t0}ms  grade ${t2 - t1}ms  cost $${(run.costUsd + g.costUsd).toFixed(5)}  cache read ${g.usage.cache_read_input_tokens ?? 0}`);
  for (const c of g.checks) console.log(`  ${c.needsReview ? "?" : c.pass ? "✓" : "✕"} ${c.key.padEnd(24)} ${c.evidence ? `"${c.evidence}"` : ""}`);
  console.log(`  tip: ${g.tip}`);
}
