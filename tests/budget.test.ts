import { describe, expect, it } from "vitest";
import { budgetAlert, checkBudget, dailyLimit } from "../src/lib/coach/budget";

describe("monthly budget alerts", () => {
  it("stays quiet under 50%", () => {
    expect(budgetAlert(0, 50)).toMatchObject({ level: 0, share: 0 });
    expect(budgetAlert(24.99, 50).level).toBe(0);
  });

  it("raises 50%, 80% and 100% at exactly those shares", () => {
    expect(budgetAlert(25, 50).level).toBe(50);
    expect(budgetAlert(39.99, 50).level).toBe(50);
    expect(budgetAlert(40, 50).level).toBe(80);
    expect(budgetAlert(49.99, 50).level).toBe(80);
    expect(budgetAlert(50, 50).level).toBe(100);
    expect(budgetAlert(80, 50)).toMatchObject({ level: 100, share: 1.6 });
  });

  it("gives one plain line per level, with no exclamation marks or trailing periods", () => {
    for (const spend of [0, 25, 40, 50]) {
      const m = budgetAlert(spend, 50).message;
      expect(m).not.toMatch(/[!.]$/);
      expect(m.length).toBeGreaterThan(0);
    }
  });

  it("treats bad input safely", () => {
    expect(budgetAlert(Number.NaN, 50).level).toBe(0);
    expect(budgetAlert(-5, 50).level).toBe(0);
    expect(budgetAlert(1, 0).level).toBe(100);
    expect(budgetAlert(0, 0).level).toBe(0);
  });

  it("agrees with checkBudget: the 80% alert warns, 100% pauses coaching", () => {
    const base = { studentTokensToday: 0, dailyTokensPerStudent: 1000, monthlyCapUsd: 50 };
    expect(checkBudget({ ...base, monthSpendUsd: 40 })).toMatchObject({ ok: true, warn: expect.any(String) });
    expect(checkBudget({ ...base, monthSpendUsd: 50 })).toMatchObject({ ok: false, reason: "monthly_cap" });
  });
});

describe("daily limit with a facilitator override", () => {
  it("uses the override when there is one, else the default", () => {
    expect(dailyLimit(null, 60_000)).toBe(60_000);
    expect(dailyLimit(undefined, 60_000)).toBe(60_000);
    expect(dailyLimit({ daily_tokens: 90_000 }, 60_000)).toBe(90_000);
    expect(dailyLimit({ daily_tokens: 0 }, 60_000)).toBe(60_000);
  });

  it("a raised limit lets a student keep practising past the default", () => {
    const today = { studentTokensToday: 70_000, monthSpendUsd: 1, monthlyCapUsd: 50 };
    expect(checkBudget({ ...today, dailyTokensPerStudent: dailyLimit(null, 60_000) })).toMatchObject({ ok: false, reason: "daily_budget" });
    expect(checkBudget({ ...today, dailyTokensPerStudent: dailyLimit({ daily_tokens: 90_000 }, 60_000) }).ok).toBe(true);
  });
});
