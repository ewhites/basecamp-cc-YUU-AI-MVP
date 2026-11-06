import fs from "node:fs";
import path from "node:path";
import type { ModuleId } from "./types";

/**
 * Lesson text the coach is grounded in. Source of truth: eval/corpus/*.md (placeholder
 * curriculum until Year Up's real lessons arrive). Read once per server process.
 */
const FILES: Record<ModuleId, string> = {
  M01: "module-01-prompting.md",
  M02: "module-02-model-comparison.md",
  M03: "module-03-agent-building.md",
};

const cache = new Map<ModuleId, string>();

export function lessonText(module: ModuleId): string {
  const hit = cache.get(module);
  if (hit) return hit;
  const text = fs.readFileSync(path.join(process.cwd(), "eval", "corpus", FILES[module]), "utf8");
  cache.set(module, text);
  return text;
}

export function sectionKeys(module: ModuleId): string[] {
  return [...lessonText(module).matchAll(/^## (M\d{2}-S\d+) — /gm)].map((m) => m[1]!);
}
