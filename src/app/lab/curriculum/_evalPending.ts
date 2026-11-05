/**
 * TEMPORARY placeholder until src/lib/evals/run.ts lands (another agent is writing it).
 * Same signature as the real runGradingEval. Under Turbopack dev, a missing import in any
 * server-action file breaks every route, so actions.ts points here until the real module exists.
 * Delete this file and import from "@/lib/evals/run" in actions.ts once it does.
 */
export async function runGradingEval(opts: {
  draft?: { id: number; exerciseId: string; key: string; text: string };
  split?: "all" | "test";
  reps?: number;
  trigger?: string;
}): Promise<{ runId: string | null; passedGate: boolean; summary: Record<string, unknown>; error?: string }> {
  void opts;
  return { runId: null, passedGate: false, summary: {}, error: "The eval runner is not installed yet, so this draft cannot be evaluated." };
}
