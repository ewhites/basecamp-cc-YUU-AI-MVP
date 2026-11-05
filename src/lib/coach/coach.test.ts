import { describe, expect, it } from "vitest";
import { getExercise } from "../curriculum/exercises";
import { costUsd } from "../models";
import { checkBudget } from "./budget";
import { detectDistress } from "./distress";
import { finalizeGrade } from "./grade";
import { scrubPii } from "./privacy";
import { coachSystemPrompt } from "./prompt";
import { quoteAppearsIn, wordCount } from "./verify";

describe("privacy scrub", () => {
  it("removes emails, phones, SSNs, cards and addresses", () => {
    const r = scrubPii(
      "Call me at (617) 555-0143 or 617.555.0199, email jas.c@example.com, SSN 123-45-6789, card 4111 1111 1111 1111, I live at 42 Elm Street.",
    );
    expect(r.text).not.toMatch(/555-0143|555\.0199|example\.com|123-45-6789|4111|Elm Street/);
    expect(r.removed).toMatchObject({ phone: 2, email: 1, ssn: 1, card: 1, address: 1 });
  });

  it("replaces the student's name with their pseudonym, whole words only", () => {
    const r = scrubPii("Hi, I'm Jasmine Carter. Jasmine wrote this. Carterville is a town.", [
      { name: "Jasmine Carter", replacement: "S-B-007" },
    ]);
    expect(r.text).toBe("Hi, I'm S-B-007. S-B-007 wrote this. Carterville is a town.");
  });

  it("removes health details", () => {
    const r = scrubPii("Use my cousin's case: she has epilepsy and was prescribed insulin. I was diagnosed with ADHD.");
    expect(r.text).not.toMatch(/epilepsy|insulin|ADHD/i);
    expect(r.removed.health).toBe(3);
  });

  it("leaves normal workplace text alone", () => {
    const t = "Call the IT Service Desk at ext. 4400 and summarize ticket #48213 in 5 bullets under 80 words.";
    expect(scrubPii(t).text).toBe(t);
  });
});

describe("distress tripwire", () => {
  it.each(["I can't cope with this anymore", "honestly I want to die", "i'm not safe at home", "thinking about suicide", "I can’t cope"])(
    "flags %s",
    (t) => expect(detectDistress(t).flagged).toBe(true),
  );
  it.each(["Kill the process and restart Outlook", "the bot should cope with errors", "I'm dying to see my score", "end the call"])(
    "does not flag %s",
    (t) => expect(detectDistress(t).flagged).toBe(false),
  );
});

describe("evidence verification", () => {
  const src = "You are a senior help-desk technician. Summarize the ticket below for the next-shift technician.";
  it("accepts exact and lightly-normalized quotes", () => {
    expect(quoteAppearsIn("You are a senior help-desk technician", src)).toBe(true);
    expect(quoteAppearsIn("“for the next-shift   technician”", src)).toBe(true);
    expect(quoteAppearsIn("you are a senior ... next-shift technician", src)).toBe(true);
  });
  it("rejects invented or reordered quotes", () => {
    expect(quoteAppearsIn("for my manager", src)).toBe(false);
    expect(quoteAppearsIn("next-shift technician ... You are a senior", src)).toBe(false);
    expect(quoteAppearsIn("", src)).toBe(false);
  });
  it("counts words", () => expect(wordCount("  one two\nthree  ")).toBe(3));
});

describe("finalizeGrade", () => {
  const ex = getExercise("ps-ticket-summary")!;
  const attempt = "You are a help-desk lead. Summarize this ticket for the next-shift technician in 5 bullets.";
  const raw = {
    checks: [
      { key: "role", evidence: "You are a help-desk lead", pass: true, reason: "ok" },
      { key: "single_task", evidence: "Summarize this ticket", pass: true, reason: "ok" },
      { key: "audience", evidence: "for the next-shift technician", pass: true, reason: "ok" },
      { key: "format", evidence: "in 5 bullets", pass: true, reason: "ok" },
      // Invented quote: coach says pass but the words are not in the attempt.
      { key: "done_condition", evidence: "do not guess the cause", pass: true, reason: "ok" },
      // protects_personal_data missing entirely.
    ],
    tip: "Add a guardrail (M01-S1).",
  };
  const g = finalizeGrade(ex, raw, { attempt, output: "..." });

  it("never counts an unverified pass", () => {
    const dc = g.checks.find((c) => c.key === "done_condition")!;
    expect(dc.pass).toBe(false);
    expect(dc.coachPass).toBe(true);
    expect(dc.needsReview).toBe(true);
    expect(dc.evidence).toBe("");
  });
  it("marks a missing check for review", () => {
    expect(g.checks.find((c) => c.key === "protects_personal_data")!.needsReview).toBe(true);
  });
  it("decides the word-count check in code", () => {
    const wc = g.checks.find((c) => c.key === "under_200_words")!;
    expect(wc.method).toBe("code");
    expect(wc.pass).toBe(true);
  });
  it("scores only verified passes", () => {
    expect(g.passed).toBe(5); // role, single_task, audience, format, under_200_words
    expect(g.total).toBe(7);
    expect(g.needsReview).toBe(true);
  });
});

describe("coach prompt", () => {
  it("is byte-stable for caching and follows the PRD section order", () => {
    const ex = getExercise("ab-newhire-it")!;
    const a = coachSystemPrompt(ex);
    expect(a).toBe(coachSystemPrompt(ex));
    const order = ["# Role and purpose", "# The lesson", "# The rubric checks", "# The rules", "# One example of a good response"].map(
      (h) => a.indexOf(h),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(a).not.toContain("under_200_words");
  });
});

describe("budget and cost", () => {
  it("blocks past the daily budget and the monthly cap", () => {
    const base = { dailyTokensPerStudent: 1000, monthlyCapUsd: 10 };
    expect(checkBudget({ ...base, studentTokensToday: 10, monthSpendUsd: 1 }).ok).toBe(true);
    expect(checkBudget({ ...base, studentTokensToday: 1000, monthSpendUsd: 1 })).toMatchObject({ ok: false, reason: "daily_budget" });
    expect(checkBudget({ ...base, studentTokensToday: 0, monthSpendUsd: 10 })).toMatchObject({ ok: false, reason: "monthly_cap" });
    expect(checkBudget({ ...base, studentTokensToday: 0, monthSpendUsd: 8.5 })).toMatchObject({ ok: true, warn: expect.any(String) });
  });
  it("prices a typical cached Haiku grading call around a tenth of a cent", () => {
    // PRD sizing: ~4,000 tokens in (mostly cached lesson + rubric) and 1,000 out.
    const c = costUsd("claude-haiku-5-5", { input_tokens: 500, cache_read_input_tokens: 3500, output_tokens: 1000 });
    expect(c).toBeCloseTo(0.000585, 6);
    const s = costUsd("claude-sonnet-5-5", { input_tokens: 4000, output_tokens: 1000 });
    expect(s).toBeCloseTo(0.018, 6);
  });
});
