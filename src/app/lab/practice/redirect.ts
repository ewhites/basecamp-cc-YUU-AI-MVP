import { redirect } from "next/navigation";
import { exercisesFor, getExercise } from "@/lib/curriculum/exercises";
import type { Studio } from "@/lib/curriculum/types";

/** Old studio URLs (and /lab/practice?ex=) open the matching practice step. Unknown ids open the studio's first task. */
export async function redirectToPractice(searchParams: Promise<{ ex?: string | string[] }>, studio?: Exclude<Studio, "check">): Promise<never> {
  const { ex } = await searchParams;
  const id = Array.isArray(ex) ? ex[0] : ex;
  const found = id ? getExercise(id) : undefined;
  const fits = found && found.studio !== "check" && (!studio || found.studio === studio);
  const target = fits ? found : exercisesFor(studio ?? "prompt")[0]!;
  redirect(`/lab/practice/${target.id}`);
}
