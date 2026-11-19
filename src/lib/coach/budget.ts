/**
 * Spend guards (PRD section 4, "Costs too much"): a daily token budget per student and a
 * monthly spend cap for the whole Lab. Pure decision logic here; the numbers come from
 * the usage_ledger table.
 */

export const DEFAULT_DAILY_TOKENS = 60_000;
export const DEFAULT_MONTHLY_CAP_USD = 50;
/** Range a facilitator may set one student's daily token limit to. */
export const MIN_DAILY_TOKENS = 1_000;
export const MAX_DAILY_TOKENS = 300_000;

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

/** The monthly budget alert levels: 50%, 80% and 100% of the cap. */
export const ALERT_LEVELS = [50, 80, 100] as const;
export type AlertLevel = 0 | (typeof ALERT_LEVELS)[number];

export interface BudgetAlert {
  /** The highest alert level reached, or 0 when spend is under 50% of the cap. */
  level: AlertLevel;
  /** Spend as a share of the cap (0 to 1 and above). */
  share: number;
  /** One plain line for staff screens. */
  message: string;
}

/** Which monthly alert the spend has reached. Pure: the caller passes month-to-date spend and the cap. */
export function budgetAlert(spendUsd: number, capUsd: number): BudgetAlert {
  const spend = Number.isFinite(spendUsd) && spendUsd > 0 ? spendUsd : 0;
  const share = capUsd > 0 ? spend / capUsd : spend > 0 ? Infinity : 0;
  const level = ([...ALERT_LEVELS].reverse().find((l) => share * 100 >= l) ?? 0) as AlertLevel;
  const message =
    level === 100
      ? "Budget reached. New coaching is paused until the cap resets or an admin raises it"
      : level === 80
        ? "Past the 80% alert. Coaching still runs, and students see a warning"
        : level === 50
          ? "Past the 50% alert. Coaching runs as normal"
          : "Under the 50% alert";
  return { level, share, message };
}

/** The daily token limit for one student: their latest override when there is one, else the default. */
export function dailyLimit(override: { daily_tokens: number } | null | undefined, defaultTokens: number): number {
  const n = Number(override?.daily_tokens);
  return override && Number.isFinite(n) && n > 0 ? n : defaultTokens;
}
