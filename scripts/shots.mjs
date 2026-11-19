// Screenshots of every redesigned route at 1440x900 and 390x844, for the design review.
// Usage: node scripts/shots.mjs [outDir] [filter]   (dev server on BASE, default http://localhost:3000)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const out = process.argv[2] ?? "shots";
const filter = process.argv[3] ?? "";
fs.mkdirSync(out, { recursive: true });

const ROUTES = [
  ["signin", null, "/signout"],
  ["design", null, "/design"],
  ["home-student", "jasmine", "/home"],
  ["welcome", "jasmine", "/lab/welcome"],
  ["lab", "jasmine", "/lab"],
  ["lesson", "jasmine", "/lab/lesson/m1"],
  ["practice-prompt", "jasmine", "/lab/practice/ps-ticket-summary"],
  ["practice-arena", "jasmine", "/lab/practice/ma-policy-summary"],
  ["practice-agent", "jasmine", "/lab/practice/ab-newhire-it"],
  ["demo-research", "jasmine", "/lab/lesson/m3/research"],
  ["demo-travel", "jasmine", "/lab/lesson/m3/travel"],
  ["check-start", "jasmine", "/lab/check/start"],
  ["check-final", "jasmine", "/lab/check/final"],
  ["skills", "jasmine", "/lab/skills"],
  ["howitworks", "jasmine", "/lab/how-it-works"],
  ["home-instructor", "rivera", "/home"],
  ["instructor", "rivera", "/lab/instructor?section=B"],
  ["student", "rivera", "/lab/instructor/student/S-B-012"],
  ["student-limit", "rivera", "/lab/instructor/student/S-B-017"],
  ["admin", "lee", "/lab/admin"],
];

const SIZES = (process.env.SIZES ?? "d,m").split(",").map((k) => ({ d: ["d", 1440, 900], w: ["w", 1920, 1080], t: ["t", 1024, 768], m: ["m", 390, 844], n: ["n", 320, 640] })[k]).filter(Boolean);
const browser = await chromium.launch();
for (const [w, width, height] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  let who = null;
  for (const [name, as, url] of ROUTES) {
    if (filter && !name.includes(filter)) continue;
    if (as !== who) {
      await ctx.clearCookies();
      if (as) await page.goto(`${BASE}/launch?as=${as}&next=/home`);
      who = as;
    }
    if (name === "lab" || name === "welcome") await ctx.addCookies([{ name: "ailab_intro", value: "it.few", url: BASE }]);
    await page.goto(BASE + url, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(out, `${name}-${w}.png`), fullPage: true });
    if (name.startsWith("demo-")) {
      // The scripted demos at the approval step, then after approving (the end).
      const go = page.getByTestId("demo-continue");
      for (let i = 0; i < 12 && !(await page.getByTestId("demo-approve").isVisible()); i++) {
        await go.click();
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(out, `${name}-approve-${w}.png`), fullPage: true });
      await page.getByTestId("demo-approve").click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(out, `${name}-end-${w}.png`), fullPage: true });
    }
  }
  if (!filter || "portfolio".includes(filter)) {
    // the public portfolio link, read from the skills page as Jasmine
    await ctx.clearCookies();
    await page.goto(`${BASE}/launch?as=jasmine&next=/lab/skills`, { waitUntil: "networkidle" });
    const link = await page.getByTestId("share-link").first().inputValue().catch(() => null);
    const href = link?.match(/\/portfolio\/[^\s"]+/)?.[0];
    if (href) {
      await ctx.clearCookies();
      await page.goto(BASE + href, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(out, `portfolio-${w}.png`), fullPage: true });
    }
  }
  await ctx.close();
}
await browser.close();
console.log("saved to", out);
