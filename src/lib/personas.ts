import type { Studio } from "./curriculum/types";

/** The four seeded demo accounts (PRD section 9, "Accounts"). All names are invented. */
export type PersonaKey = "jasmine" | "rivera" | "okafor" | "lee";
export type Role = "student" | "instructor" | "curriculum" | "admin";

export interface Persona {
  key: PersonaKey;
  name: string;
  role: Role;
  email: string;
  landing: string;
  description: string;
}

export const PERSONAS: Persona[] = [
  {
    key: "jasmine",
    name: "Jasmine Carter",
    role: "student",
    email: "jasmine.carter@students.yearup.example",
    landing: "/lab",
    description: "Student, IT support track, Section B",
  },
  {
    key: "rivera",
    name: "Ms. Rivera",
    role: "instructor",
    email: "m.rivera@staff.yearup.example",
    landing: "/lab/instructor",
    description: "Instructor, Sections B and C",
  },
  {
    key: "okafor",
    name: "Dev Okafor",
    role: "curriculum",
    email: "d.okafor@staff.yearup.example",
    landing: "/lab/curriculum",
    description: "Curriculum designer",
  },
  {
    key: "lee",
    name: "Sam Lee",
    role: "admin",
    email: "s.lee@staff.yearup.example",
    landing: "/lab/admin",
    description: "Admin, Solutions team",
  },
];

/** A second instructor (Section A) so cross-section blocking can be shown. Not in the role switcher. */
export const SECTION_A_INSTRUCTOR = { key: "haddad", name: "Mr. Haddad", email: "o.haddad@staff.yearup.example" };

export const JASMINE_STUDENT_ID = "S-B-012";

export function persona(key: string): Persona | undefined {
  return PERSONAS.find((p) => p.key === key);
}

export const STUDIO_PATHS: Record<Studio, string> = {
  prompt: "/lab/prompt-studio",
  arena: "/lab/model-arena",
  agent: "/lab/agent-builder",
};
