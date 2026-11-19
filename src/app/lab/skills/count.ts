import { SKILLS } from "@/lib/curriculum/types";

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** How many skills the course has, as a word ("five"). Read from SKILLS, never hard-coded. */
export const SKILL_COUNT = SKILLS.length;
export const SKILL_COUNT_WORD = WORDS[SKILL_COUNT] ?? String(SKILL_COUNT);

/** The score on the final check that earns the badge, on every skill. */
export const BADGE_LINE = 0.8;
