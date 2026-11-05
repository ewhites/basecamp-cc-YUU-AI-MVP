import "server-only";
import { userClient } from "./db";
import { computeProgress, type AttemptRow, type Progress } from "./progress-core";

/** Where the signed-in student is in the course. Every read goes through the access rules. */
export * from "./progress-core";

export async function myProgress(): Promise<Progress> {
  const db = await userClient();
  const [{ data: attempts }, { data: lessons }] = await Promise.all([
    db.from("attempts").select("exercise_id, status, passed, total"),
    db.from("lesson_progress").select("step_id"),
  ]);
  return computeProgress((attempts ?? []) as AttemptRow[], new Set((lessons ?? []).map((l) => l.step_id as string)));
}
