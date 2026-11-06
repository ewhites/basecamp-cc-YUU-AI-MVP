/**
 * Spend guards (PRD section 4, "Costs too much"): a daily token budget per student and a
 * monthly spend cap for the whole Lab. Pure decision logic here; the numbers come from
 * the usage_ledger table.
 */

export const DEFAULT_DAILY_TOKENS = 60_000;
export const DEFAULT_MONTHLY_CAP_USD = 50;

export function budgetConfig() {
  const daily = Number(process.env.LAB_DAILY_TOKEN_BUDGET_PER_STUDENT ?? DEFAULT_DAILY_TOKENS);
  const cap = Number(process.env.LAB_MONTHLY_SPEND_CAP_USD ?? DEFAULT_MONTHLY_CAP_USD);
  return {
    dailyTokensPerStudent: Number.isFinite(daily) && daily > 0 ? daily : DEFAULT_DAILY_TOKENS,
    monthlyCapUsd: Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_MONTHLY_CAP_USD,
  };
}

export type BudgetDecision =
  | { ok: true; warn?: string }
  | { ok: false; reason: "daily_budget" | "monthly_cap"; message: string };

export function checkBudget(input: {
  studentTokensToday: number;
  monthSpendUsd: number;
  dailyTokensPerStudent: number;
  monthlyCapUsd: number;
}): BudgetDecision {
  if (input.monthSpendUsd >= input.monthlyCapUsd) {
    return {
      ok: false,
      reason: "monthly_cap",
      message:
        "The AI Lab has reached its monthly spend cap, so new coaching is paused. Your work is saved and will be scored when the cap resets or an admin raises it.",
    };
  }
  if (input.studentTokensToday >= input.dailyTokensPerStudent) {
    return {
      ok: false,
      reason: "daily_budget",
      message:
        "You've used today's practice budget. Your attempt is saved and will be scored tomorrow. Nice work putting in the reps.",
    };
  }
  if (input.monthSpendUsd >= input.monthlyCapUsd * 0.8) {
    return { ok: true, warn: "The Lab is above 80% of its monthly spend cap." };
  }
  return { ok: true };
}
