/** URLs and small formatters shared by the instructor pages. */

export function sectionHref(sectionId: string): string {
  return `/lab/instructor?section=${encodeURIComponent(sectionId)}`;
}

export function studentHref(studentId: string, attemptId?: string | null): string {
  const base = `/lab/instructor/student/${encodeURIComponent(studentId)}`;
  return attemptId ? `${base}?attempt=${encodeURIComponent(attemptId)}` : base;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** 0.4167 -> "42%". Null -> an en dash for "no data". */
export function percent(x: number | null | undefined): string {
  return x === null || x === undefined ? "–" : `${Math.round(x * 100)}%`;
}

/** 0.18 -> "+18%", -0.05 -> "−5%". */
export function signedPercent(x: number | null | undefined): string {
  if (x === null || x === undefined) return "–";
  const n = Math.round(x * 100);
  return n > 0 ? `+${n}%` : n < 0 ? `−${Math.abs(n)}%` : "0%";
}
