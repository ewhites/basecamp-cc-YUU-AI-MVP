import type { Studio } from "./curriculum/types";

/**
 * The two accounts you can sign in as (simulated Year Up sign-in). All names are invented.
 * Curriculum and admin accounts still exist in the data layer, so the four-role access rules
 * stay tested (tests/rls.test.ts, MCP server), but they have no screens in this demo.
 */
export type PersonaKey = "jasmine" | "rivera";
export type Role = "student" | "instructor" | "curriculum" | "admin";

export interface Persona {
  key: PersonaKey;
  name: string;
  initials: string;
  role: Role;
  email: string;
  landing: string;
  description: string;
}

export const PERSONAS: Persona[] = [
  {
    key: "jasmine",
    name: "Jasmine Carter",
    initials: "JC",
    role: "student",
    email: "jasmine.carter@students.yearup.example",
    landing: "/home",
    description: "Student · IT support · Section B",
  },
  {
    key: "rivera",
    name: "Ms. Rivera",
    initials: "MR",
    role: "instructor",
    email: "m.rivera@staff.yearup.example",
    landing: "/home",
    description: "Instructor · Sections B and C",
  },
];

/** Data-layer-only accounts (no sign-in, no screens). */
export const BACKOFFICE_ACCOUNTS = [
  { key: "okafor", name: "Dev Okafor", role: "curriculum" as Role },
  { key: "lee", name: "Sam Lee", role: "admin" as Role },
];

/** A second instructor (Section A) so cross-section blocking can be shown. */
export const SECTION_A_INSTRUCTOR = { key: "haddad", name: "Mr. Haddad", email: "o.haddad@staff.yearup.example" };

export const JASMINE_STUDENT_ID = "S-B-012";

export function persona(key: string): Persona | undefined {
  return PERSONAS.find((p) => p.key === key);
}

export const STUDIO_PATHS: Record<Studio, string> = {
  prompt: "/lab/practice",
  arena: "/lab/practice",
  agent: "/lab/practice",
  check: "/lab/check",
};
