/**
 * Model choices and the price table every cost figure in the app is computed from.
 * Prices are Anthropic first-party list prices in USD per million tokens
 * (claude-api skill table, cached 2026-10-06). Shown in the UI as estimates.
 * Haiku 5.5's rate applies to prompts of 100K tokens or fewer, which covers every call here.
 */
export const MODELS = {
  haiku: "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
  opus: "claude-opus-5-5",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

/** Grading model. Haiku first, per the PRD; move up only if the eval says so. */
export const GRADER_MODEL: ModelId = MODELS.haiku;
/** Effort for grading calls. "low" measured 95% held-out agreement, 96% consistency, 20/20 safety (coach-v5, eval run 2026-11-05). */
export const GRADER_EFFORT = "low" as const;
/** Model that runs the student's own prompt / bot in Prompt Studio and Agent Builder. */
export const RUNNER_MODEL: ModelId = MODELS.haiku;
/** Lesson Q&A coach. */
export const QA_MODEL: ModelId = MODELS.haiku;

export const ARENA_MODELS: { id: ModelId; label: string; blurb: string }[] = [
  { id: MODELS.haiku, label: "Claude Haiku 5.5", blurb: "Fastest and cheapest" },
  { id: MODELS.sonnet, label: "Claude Sonnet 5.5", blurb: "Balanced" },
  { id: MODELS.opus, label: "Claude Opus 5.5", blurb: "Most capable" },
];

const PRICES: Record<ModelId, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

export interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** Cost of one call in USD. Cache reads bill at 0.1x input, 5-minute cache writes at 1.25x. */
export function costUsd(model: string, usage: UsageLike): number {
  const p = PRICES[model as ModelId] ?? PRICES[MODELS.opus];
  const perTok = (rate: number) => rate / 1_000_000;
  return (
    usage.input_tokens * perTok(p.input) +
    (usage.cache_read_input_tokens ?? 0) * perTok(p.input) * 0.1 +
    (usage.cache_creation_input_tokens ?? 0) * perTok(p.input) * 1.25 +
    usage.output_tokens * perTok(p.output)
  );
}

export function modelLabel(model: string): string {
  return ARENA_MODELS.find((m) => m.id === model)?.label ?? model;
}
