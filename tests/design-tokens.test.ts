import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Design rule (docs/redesign/BUILD-PLAN.md): no hard-coded colour outside src/design/tokens.css.
 * Pages and components use the tokens, so the look changes in one place.
 */
const ROOT = path.join(process.cwd(), "src");
const TOKENS = path.join(ROOT, "design", "tokens.css");

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return p.includes(`${path.sep}lib`) ? [] : files(p);
    return /\.(css|tsx)$/.test(e.name) ? [p] : [];
  });
}

const HEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b(?![0-9a-zA-Z-])/;
const FUNC = /\b(?:rgba?|hsla?|oklch|lab|lch)\(/;

describe("design tokens", () => {
  it("has no colour value outside src/design/tokens.css", () => {
    const hits: string[] = [];
    for (const f of files(ROOT)) {
      if (f === TOKENS) continue;
      fs.readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          // In TSX, only style values count (a "#" in copy, like "Ticket #48213" or "#it-help", is text).
          const code = f.endsWith(".tsx") ? (line.match(/(?:style=\{\{|color|background|fill|stroke)[^}]*/)?.[0] ?? "") : line.replace(/\/\*.*?\*\//g, "");
          if (HEX.test(code) || FUNC.test(code)) hits.push(`${path.relative(process.cwd(), f)}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
