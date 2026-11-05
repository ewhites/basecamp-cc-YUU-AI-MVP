/**
 * Strips personal information from student-written text before it is sent to Claude.
 * PRD: "Before any call, replace the student's name with an ID and strip anything that
 * looks like personal information."
 *
 * Deterministic regexes, so it is cheap, testable and never sends the raw text anywhere.
 * It errs toward removing too much (a false positive costs a word; a miss leaks data).
 */

export type PiiKind = "name" | "email" | "phone" | "ssn" | "card" | "address";

export interface ScrubResult {
  text: string;
  removed: Partial<Record<PiiKind, number>>;
}

const PATTERNS: { kind: Exclude<PiiKind, "name">; re: RegExp; token: string }[] = [
  { kind: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, token: "[EMAIL REMOVED]" },
  // US SSN-shaped numbers.
  { kind: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g, token: "[ID NUMBER REMOVED]" },
  // Card-like digit runs: 13-19 digits with optional single spaces or dashes.
  { kind: "card", re: /\b(?:\d[ -]?){12,18}\d\b/g, token: "[CARD NUMBER REMOVED]" },
  // US phone numbers: (617) 555-0143, 617-555-0143, 617.555.0143, +1 617 555 0143.
  { kind: "phone", re: /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g, token: "[PHONE REMOVED]" },
  // Street addresses: "42 Elm Street", "1200 W Main St".
  {
    kind: "address",
    re: /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Ter)\b\.?/g,
    token: "[ADDRESS REMOVED]",
  },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param names people to replace with a pseudonym, e.g. the student's own name.
 *   Full name first, then each part of 3+ letters, so "Jasmine Carter" and "Jasmine" both go.
 */
export function scrubPii(
  input: string,
  names: { name: string; replacement: string }[] = [],
): ScrubResult {
  let text = input;
  const removed: ScrubResult["removed"] = {};
  const bump = (k: PiiKind, n: number) => {
    if (n > 0) removed[k] = (removed[k] ?? 0) + n;
  };

  for (const { kind, re, token } of PATTERNS) {
    let n = 0;
    text = text.replace(re, () => {
      n++;
      return token;
    });
    bump(kind, n);
  }

  for (const { name, replacement } of names) {
    const parts = [name, ...name.split(/\s+/)].filter((p) => p.trim().length >= 3);
    for (const part of parts) {
      let n = 0;
      text = text.replace(new RegExp(`\\b${escapeRegex(part)}\\b`, "gi"), () => {
        n++;
        return replacement;
      });
      bump("name", n);
    }
  }

  return { text, removed };
}

export function removedSummary(r: ScrubResult["removed"]): string {
  const parts = Object.entries(r).map(([k, n]) => `${n} ${k}${n === 1 ? "" : "s"}`);
  return parts.join(", ");
}
