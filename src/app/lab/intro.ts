/**
 * The two first-visit answers, kept in one cookie (no change to the data layer).
 * Value: "<work>.<experience>", for example "it.few". Read on the server with readIntro(await cookies()).
 * Used for two things only: practice tasks of the chosen kind of work come first in a module,
 * and the worked example opens by default for "never" and "few".
 */
export const INTRO_COOKIE = "ailab_intro";

export const WORK = {
  it: "IT support",
  ops: "Business operations",
  cs: "Customer success",
  fin: "Finance",
  unsure: "Not sure yet",
} as const;
export type Work = keyof typeof WORK;

export const EXPERIENCE = {
  never: "Never",
  few: "A few times",
  weekly: "Most weeks",
  daily: "Every day",
} as const;
export type Experience = keyof typeof EXPERIENCE;

export interface Intro {
  work: Work;
  experience: Experience;
}

export function encodeIntro(i: Intro): string {
  return `${i.work}.${i.experience}`;
}

export function parseIntro(raw: string | undefined | null): Intro | null {
  if (!raw) return null;
  const [w, e] = raw.split(".");
  if (!w || !e || !(w in WORK) || !(e in EXPERIENCE)) return null;
  return { work: w as Work, experience: e as Experience };
}

/** Works with Next's cookies() store or anything with get(name). */
export function readIntro(store: { get(name: string): { value: string } | undefined }): Intro | null {
  return parseIntro(store.get(INTRO_COOKIE)?.value);
}

/** The exercise track that matches the chosen kind of work, or null for "Not sure yet". */
export function trackFor(intro: Intro | null): string | null {
  if (!intro || intro.work === "unsure") return null;
  return WORK[intro.work];
}

/** True when the worked example should open by default. */
export function exampleOpenByDefault(intro: Intro | null): boolean {
  return !intro || intro.experience === "never" || intro.experience === "few";
}

/** Puts items of the chosen track first, keeping the order otherwise. */
export function trackFirst<T extends { track: string }>(items: T[], intro: Intro | null): T[] {
  const t = trackFor(intro);
  if (!t) return items;
  return [...items.filter((x) => x.track === t), ...items.filter((x) => x.track !== t)];
}
