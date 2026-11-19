import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ALL_STEPS } from "@/lib/curriculum/course";
import { skillCheck } from "@/lib/curriculum/skill-checks";
import { getViewer } from "@/lib/session";
import { readIntro } from "../intro";
import { Welcome } from "./Welcome";

/** The first visit: one question a screen. The lab sends a new student here once; it can be revisited. */
export default async function WelcomePage() {
  const v = await getViewer();
  if (!v) redirect("/");
  if (v.role !== "student") redirect("/lab/instructor");
  const intro = readIntro(await cookies());
  const first = (v.student?.display_name ?? v.name).split(" ")[0] ?? "";
  const tasks = skillCheck("start").length;
  const minutes = ALL_STEPS.find((s) => s.id === "check-start")?.minutes ?? 10;
  return (
    <div className="ds-page en-welcome">
      <Welcome first={first} tasks={tasks} minutes={minutes + 2} initial={intro} />
    </div>
  );
}
