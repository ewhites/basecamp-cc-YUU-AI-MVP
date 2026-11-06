import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";

/**
 * The demo script (docs/demo-script.md), end to end. Steps that call Claude run only when an
 * API key is available, so the rest of the journey is still checked without one.
 */
const hasKey = !!process.env.ANTHROPIC_API_KEY || fs.existsSync(".env.local");

/** Fill a box and wait until its submit button is enabled (text typed before hydration is lost). */
async function fillReady(page: Page, input: string, button: string, text: string) {
  await expect(async () => {
    await page.getByTestId(input).fill(text);
    await expect(page.getByTestId(button)).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
}

test("sign-in offers only the student and the instructor, then opens Brightspace", async ({ page }) => {
  await page.goto("/signout");
  await expect(page.getByText(/Simulated/).first()).toBeVisible();
  await expect(page.getByText("Sample data").first()).toBeVisible();
  await expect(page.locator(".account")).toHaveCount(2);
  await expect(page.getByText("Dev Okafor")).toHaveCount(0);
  await page.getByTestId("signin-jasmine").click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText("Welcome, Jasmine")).toBeVisible();
  await page.getByTestId("course-tile").click();
  await expect(page).toHaveURL(/\/lab$/);
  await expect(page.getByTestId("up-next")).toContainText(/Starting point check|Up next/);
  await expect(page.getByText("Security check")).toHaveCount(0);
});

test("starting point check: one task is coached and counts toward progress", async ({ page }) => {
  test.skip(!hasKey, "needs ANTHROPIC_API_KEY");
  await page.goto("/launch?as=jasmine&next=/lab/check/start?task=1");
  await expect(page.getByTestId("check-task")).toBeVisible();
  await fillReady(page, "check-answer", "check-submit",
    "Write a reminder email to my team about the shared drive moving to the new system this Friday at 6pm. Tell them to save their files before 5pm Friday. Keep it under 80 words with 3 bullets.",
  );
  await page.getByTestId("check-submit").click();
  await expect(page.getByTestId("check-result")).toBeVisible();
  await expect(page.getByTestId("check-score")).toBeVisible();
  await expect(page.getByTestId("check-next")).toBeVisible();
});

test("Prompt Studio: weak attempt is coached, tip applied, second attempt improves", async ({ page }) => {
  test.skip(!hasKey, "needs ANTHROPIC_API_KEY");
  await page.goto("/launch?as=jasmine&next=/lab/prompt-studio?ex=ps-ticket-summary");
  await fillReady(page, "prompt-input", "submit-prompt",
    "You are a help-desk lead. Summarize the ticket below for the next-shift technician. Use only the ticket text and don't guess. Leave out names, phone numbers and employee IDs.",
  );
  await page.getByTestId("submit-prompt").click();
  const latest = page.getByTestId("attempt-result").first();
  await expect(latest.getByText("Attempt 1")).toBeVisible();
  await expect(latest.getByTestId("check-format")).toHaveAttribute("data-state", "fail");
  await expect(latest.getByTestId("coach-tip")).toBeVisible();
  const first = Number((await latest.getByTestId("attempt-score").innerText()).split("/")[0]);

  await fillReady(page, "prompt-input", "submit-prompt",
    "You are a help-desk lead. Summarize the ticket below for the next-shift technician in 5 bullet points under 80 words: problem, what was tried, current status, next step. Use only the ticket text and don't guess. Leave out names, phone numbers and employee IDs.",
  );
  await page.getByTestId("submit-prompt").click();
  await expect(latest.getByText("Attempt 2")).toBeVisible();
  await expect(latest.getByTestId("check-format")).toHaveAttribute("data-state", "pass");
  const second = Number((await latest.getByTestId("attempt-score").innerText()).split("/")[0]);
  expect(second).toBeGreaterThan(first);
});

test("student pages render, and old studio links redirect to the course", async ({ page }) => {
  await page.goto("/launch?as=jasmine");
  for (const url of ["/lab", "/lab/check/start", "/lab/check/final", "/lab/lesson/m1", "/lab/lesson/m2", "/lab/lesson/m3", "/lab/practice/ps-ticket-summary", "/lab/practice/ma-policy-summary", "/lab/practice/ab-newhire-it", "/lab/skills"]) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBe(200);
    await expect(page.getByText("Sample data").first()).toBeVisible();
  }
  await page.goto("/lab/model-arena");
  await expect(page).toHaveURL(/\/lab\/practice\/ma-/);
  await page.goto("/lab/portfolio");
  await expect(page).toHaveURL(/\/lab\/skills/);
  await expect(page.getByText("Best work", { exact: false })).toHaveCount(0);
});

test("lesson: worked example first, then Start practice opens the first task", async ({ page }) => {
  await page.goto("/launch?as=jasmine&next=/lab/lesson/m2");
  await expect(page.getByTestId("worked-example")).toBeVisible();
  await page.getByTestId("start-practice").click();
  await expect(page).toHaveURL(/\/lab\/practice\/ma-policy-summary/);
  await expect(page.getByTestId("arena-steps")).toBeVisible();
});

test("instructor console leads with who needs help, then the lift", async ({ page }) => {
  await page.goto("/launch?as=rivera");
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/lab/instructor?section=B");
  await expect(page.getByTestId("needs-you")).toBeVisible();
  await expect(page.getByTestId("needs-you-row").first()).toBeVisible();
  await expect(page.getByText(/3 students stuck on Description/i).first()).toBeVisible();
  await expect(page.getByTestId("lift-panel")).toBeVisible();
  await expect(page.getByTestId("coach-reliability")).toBeVisible();
  const res = await page.goto("/lab/instructor?section=A");
  expect(res?.status()).toBe(200);
  await expect(page.getByText(/don.t teach that section/i)).toBeVisible();
});

test("removed screens and accounts are gone", async ({ page }) => {
  for (const who of ["okafor", "lee"]) {
    await page.goto(`/launch?as=${who}`);
    await expect(page).toHaveURL(/\/$/);
  }
  await page.goto("/launch?as=rivera");
  for (const url of ["/lab/admin", "/lab/curriculum", "/lab/security-check"]) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBe(404);
  }
});
