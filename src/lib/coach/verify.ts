/**
 * Evidence verification. The coach must quote the student's own words for every check.
 * A model can paraphrase or invent a quote and still sound right, so this checks in code
 * that each quote really appears in the source text.
 *
 * A quote may use "..." (or the ellipsis character) to skip words; each fragment must appear
 * in the source, in order.
 */

export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’‚‛′`]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function stripWrapping(q: string): string {
  return q.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
}

export function quoteAppearsIn(quote: string, source: string): boolean {
  const q = stripWrapping(quote);
  if (q.length < 3) return false;
  const hay = normalizeForMatch(source);
  const fragments = normalizeForMatch(q)
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((f) => f.replace(/^[\s.,;:!?-]+|[\s.,;:!?-]+$/g, ""))
    .filter((f) => f.length > 0);
  if (fragments.length === 0) return false;
  let from = 0;
  for (const f of fragments) {
    const at = hay.indexOf(f, from);
    if (at === -1) return false;
    from = at + f.length;
  }
  return true;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
