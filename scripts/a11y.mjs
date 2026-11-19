// Accessibility check of every route: axe-core (WCAG 2.2 A and AA) and sideways scroll at 320px.
// Usage: node scripts/a11y.mjs   (dev server on BASE, default http://localhost:3000)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { createRequire } from "node:module";

const BASE = process.env.BASE ?? "http://localhost:3000";
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const ROUTES = [
  [null, "/signout"],
  ["jasmine", "/lab/welcome"],
  ["jasmine", "/lab"],
  ["jasmine", "/lab/lesson/m1"],
  ["jasmine", "/lab/lesson/m3"],
  ["jasmine", "/lab/practice/ps-ticket-summary"],
  ["jasmine", "/lab/practice/ma-policy-summary"],
  ["jasmine", "/lab/practice/ab-newhire-it"],
  ["jasmine", "/lab/check/start"],
  ["jasmine", "/lab/skills"],
  ["jasmine", "/lab/how-it-works"],
  ["rivera", "/lab/instructor?section=B"],
  ["rivera", "/lab/instructor/student/S-B-003"],
  ["lee", "/lab/admin"],
];

const browser = await chromium.launch();
let failures = 0;
for (const [width, height] of [[1440, 900], [320, 700]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  let who;
  for (const [as, url] of ROUTES) {
    if (as !== who) {
      await ctx.clearCookies();
      if (as) await page.goto(`${BASE}/launch?as=${as}&next=/lab`);
      await ctx.addCookies([{ name: "ailab_intro", value: "it.few", url: BASE }]);
      who = as;
    }
    await page.goto(BASE + url, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    let violations = [];
    if (width === 1440) {
      await page.addScriptTag({ content: axeSource });
      const r = await page.evaluate(() =>
        axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }),
      );
      violations = r.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ")}`);
    }
    const bad = violations.length || sideways;
    if (bad) failures++;
    console.log(`${bad ? "FAIL" : "ok  "} ${width}px ${as ?? "-"} ${url}${sideways ? " SIDEWAYS SCROLL" : ""}`);
    for (const v of violations) console.log("     ", v);
  }
  await ctx.close();
}
await browser.close();
console.log(failures ? `${failures} problems` : "no problems");
process.exit(failures ? 1 : 0);
