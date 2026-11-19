import { redirect } from "next/navigation";
import { Dock, type DockPlace } from "@/design/Dock";
import { Ground } from "@/design/Ground";
import { preload } from "react-dom";
import { TopBar } from "@/design/TopBar";
import { MODULE_INFO } from "@/lib/curriculum/course";
import { mySections, needsYouToday, sectionOverview } from "@/lib/instructor-data";
import { persona } from "@/lib/personas";
import { myProgress } from "@/lib/progress";
import { getViewer } from "@/lib/session";
import { sectionHref, studentHref } from "./instructor/links";

const LEARN_PATHS = ["/lab/lesson", "/lab/practice", "/lab/check", "/lab/prompt-studio", "/lab/model-arena", "/lab/agent-builder"];

/** Student dock: Home, Learn (the lesson of the module you are in), Skills, and Next (the next unfinished step). */
async function studentDock(): Promise<{ places: DockPlace[]; next: { label: string; href: string } | null }> {
  const progress = await myProgress();
  const step = progress.next;
  const learnHref = !step || step.kind === "skills" ? `/lab/lesson/${MODULE_INFO.M01.slug}` : step.module ? `/lab/lesson/${MODULE_INFO[step.module].slug}` : step.href;
  return {
    places: [
      { label: "Home", href: "/lab", icon: "home", match: ["/lab$", "/lab/welcome"] },
      { label: "Learn", href: learnHref, icon: "learn", match: LEARN_PATHS },
      { label: "Skills", href: "/lab/skills", icon: "skills", match: ["/lab/skills", "/lab/portfolio"] },
    ],
    next: { label: "Next", href: step?.href ?? "/lab/skills" },
  };
}

/**
 * Facilitator dock: Class (the console), Students (cohort progress on the console, and every student page),
 * Coach (the reliability view on the console), and Next, which opens the first "needs you" row.
 * Students and Coach are sections of the console, so they link to its anchors in the facilitator's section.
 */
async function instructorDock(): Promise<{ places: DockPlace[]; next: { label: string; href: string } | null }> {
  const place = (sid: string | undefined): DockPlace[] => {
    const home = sid ? sectionHref(sid) : "/lab/instructor";
    return [
      { label: "Class", href: home, icon: "home", match: ["/lab/instructor$", "/lab$"] },
      { label: "Students", href: `${home}#students`, icon: "class", match: ["/lab/instructor/student"] },
      { label: "Coach", href: `${home}#coach`, icon: "chat", match: [] },
    ];
  };
  try {
    const sections = await mySections();
    const sid = sections.some((s) => s.id === "B") ? "B" : sections[0]?.id;
    const places = place(sid);
    if (!sid) return { places, next: null };
    const overview = await sectionOverview(sid);
    const first = (await needsYouToday(overview))[0];
    if (!first) return { places, next: null };
    const href =
      first.kind === "class"
        ? `${sectionHref(sid)}${first.skill === overview.miniLesson?.skill ? "#mini-lesson" : "#heatmap"}`
        : `${studentHref(first.student_id, first.attempt_id)}#why`;
    return { places, next: { label: "Next", href } };
  } catch {
    return { places: place(undefined), next: null };
  }
}

/**
 * The lab shell: the ground, the top bar, the page, and the dock. The left syllabus rail is gone.
 * The ground is "study" (calm) on lessons, practice, checks and instructor pages, "show" on the course home and skills.
 */
export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v) redirect("/");
  const p = persona(v.persona);
  const user = { name: v.name, initials: p?.initials ?? v.name.slice(0, 2).toUpperCase(), detail: p?.description ?? "" };
  const dock = v.role === "student" ? await studentDock() : await instructorDock();

  // The ground image is the first thing painted: fetch it early.
  preload("/materials/ground.webp", { as: "image", fetchPriority: "high" });

  return (
    <Ground>
      <a href="#main" className="ds-skip">
        Skip to content
      </a>
      <TopBar user={user} />
      <main id="main" className="ds-content">
        {children}
      </main>
      <Dock places={dock.places} next={dock.next} />
    </Ground>
  );
}
