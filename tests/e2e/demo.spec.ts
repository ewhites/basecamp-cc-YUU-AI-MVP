import { expect, test } from "@playwright/test";
import fs from "node:fs";

/**
 * The demo script (docs/demo-script.md), end to end. Steps that call Claude run only when an
 * API key is available, so the rest of the journey is still checked without one.
 */
const hasKey = !!process.env.ANTHROPIC_API_KEY || fs.existsSync(".env.local");

test("course page labels everything simulated and launches by role", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("AI Foundations").first()).toBeVisible();
  await expect(page.getByText("Sample data").first()).toBeVisible();
  await expect(page.getByText(/Simulated/).first()).toBeVisible();
  await page.getByTestId("launch-jasmine").click();
  await expect(page).toHaveURL(/\/lab$/);
  await expect(page.getByText("Welcome back, Jasmine")).toBeVisible();
  await expect(page.getByText("S-B-012").first()).toBeVisible();
});

test("Prompt Studio: weak attempt is coached, tip applied, second attempt improves", async ({ page }) => {
  test.skip(!hasKey, "needs ANTHROPIC_API_KEY");
  await page.goto("/launch?as=jasmine&next=/lab/prompt-studio?ex=ps-ticket-summary");
  await page.getByTestId("prompt-input").fill(
    "You are a help-desk lead. Summarize the ticket below for the next-shift technician. Use only the ticket text and don't guess. Leave out names, phone numbers and employee IDs.",
  );
  await page.getByTestId("submit-prompt").click();
  const latest = page.getByTestId("attempt-result").first();
  await expect(latest.getByText("Attempt 1")).toBeVisible();
  await expect(latest.getByTestId("check-format")).toHaveAttribute("data-state", "fail");
  await expect(latest.getByTestId("coach-tip")).toBeVisible();
  const first = Number((await latest.getByTestId("attempt-score").innerText()).split("/")[0]);

  await page.getByTestId("prompt-input").fill(
    "You are a help-desk lead. Summarize the ticket below for the next-shift technician in 5 bullet points under 80 words: problem, what was tried, current status, next step. Use only the ticket text and don't guess. Leave out names, phone numbers and employee IDs.",
  );
  await page.getByTestId("submit-prompt").click();
  await expect(latest.getByText("Attempt 2")).toBeVisible();
  await expect(latest.getByTestId("check-format")).toHaveAttribute("data-state", "pass");
  const second = Number((await latest.getByTestId("attempt-score").innerText()).split("/")[0]);
  expect(second).toBeGreaterThan(first);
});

test("student pages render", async ({ page }) => {
  await page.goto("/launch?as=jasmine");
  for (const path of ["/lab/prompt-studio", "/lab/model-arena", "/lab/agent-builder", "/lab/portfolio"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByText("Sample data").first()).toBeVisible();
  }
});

test("security check: every forbidden query is blocked for each role", async ({ page }) => {
  for (const who of ["jasmine", "rivera", "okafor", "lee"]) {
    await page.goto(`/launch?as=${who}&next=/lab/security-check`);
    const table = page.getByTestId("security-probes");
    await expect(table).toBeVisible();
    await expect(table.getByText("Unexpected")).toHaveCount(0);
  }
});

test("instructor console shows three Section B students stuck on Description", async ({ page }) => {
  await page.goto("/launch?as=rivera");
  await expect(page).toHaveURL(/\/lab\/instructor/);
  await expect(page.getByText(/3 students stuck on Description/i).first()).toBeVisible();
  const res = await page.goto("/lab/instructor?section=A");
  expect(res?.status()).toBe(200);
  await expect(page.getByText(/don.t teach that section/i)).toBeVisible();
});

test("staff homes render for curriculum and admin", async ({ page }) => {
  await page.goto("/launch?as=okafor");
  await expect(page).toHaveURL(/\/lab\/curriculum/);
  await expect(page.getByText("Sample data").first()).toBeVisible();
  await page.goto("/launch?as=lee");
  await expect(page).toHaveURL(/\/lab\/admin/);
  await expect(page.getByText(/audit/i).first()).toBeVisible();
});
