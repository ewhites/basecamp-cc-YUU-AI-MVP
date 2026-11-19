// Renders the two materials (blue linen, orange marble) to WebP files in public/materials/.
// Run from the repo root: node scripts/materials/render.mjs [--seed=3] [--out=public/materials]
// It opens scripts/materials/render.html in headless Chromium (Playwright) and saves each canvas.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d;
const seed = arg("seed", "3");
const out = path.resolve(arg("out", "public/materials"));
fs.mkdirSync(out, { recursive: true });

const jobs = [
  { name: "ground", mode: "ground", w: 2560, h: 1600, q: 0.86 },
  { name: "ground-tall", mode: "ground", w: 1200, h: 2400, q: 0.86 },
  { name: "marble", mode: "marble", w: 1600, h: 1000, q: 0.88 },
  { name: "linen", mode: "linen", w: 1200, h: 1200, q: 0.86 },
];

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
for (const j of jobs) {
  const url = `${pathToFileURL(path.join(here, "render.html"))}?mode=${j.mode}&w=${j.w}&h=${j.h}&seed=${seed}`;
  await page.goto(url);
  await page.waitForFunction(() => window.rendered === true, null, { timeout: 120_000 });
  const data = await page.evaluate((q) => document.getElementById("c").toDataURL("image/webp", q), j.q);
  const file = path.join(out, `${j.name}.webp`);
  fs.writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
  console.log(`${file}  ${Math.round(fs.statSync(file).size / 1024)} KB`);
}
await browser.close();
