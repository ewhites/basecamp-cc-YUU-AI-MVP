import { redirect } from "next/navigation";
import { Dock, type DockPlace } from "@/design/Dock";
import { Ground } from "@/design/Ground";
import { SideRail, type RailGroup, type RailList, type RailProps } from "@/design/SideRail";
import { preload } from "react-dom";
import { TopBar } from "@/design/TopBar";
import { COURSE, MODULE_INFO } from "@/lib/curriculum/course";
import { mySections, needsYouToday, sectionOverview } from "@/lib/instructor-data";
import { persona } from "@/lib/personas";
import { myProgress } from "@/lib/progress";
import { getViewer } from "@/lib/session";
import { sectionHref, studentHref } from "./instructor/links";

const LEARN_PATHS = ["/lab/lesson", "/lab/practice", "/lab/check", "/lab/prompt-studio", "/lab/model-arena", "/lab/agent-builder"];

/** Student dock: Home, Learn (the lesson of the module you are in), Skills, and Next (the next unfinished step). */
type Chrome = { places: DockPlace[]; next: { label: string; href: string } | null; rail: Omit<RailProps, "places" | "next"> };

async function studentDock(): Promise<Chrome> {
  const progress = await myProgress();
  const groups: RailGroup[] = COURSE.map((g) => ({
    id: g.id,
    title: g.title,
    done: g.steps.filter((s) => progress.states[s.id]?.done).length,
    total: g.steps.length,
    steps: g.steps.map((s) => {
      const st = progress.states[s.id];
      return { id: s.id, title: s.title, href: s.href, kind: s.kind, state: st?.done ? "done" : st?.started ? "started" : "todo" };
    }),
  }));
  const course = { done: progress.done, total: groups.reduce((n, g) => n + g.total, 0), groups };
  const step = progress.next;
  const learnHref = !step || step.kind === "skills" ? `/lab/lesson/${MODULE_INFO.M01.slug}` : step.module ? `/lab/lesson/${MODULE_INFO[step.module].slug}` : step.href;
  return {
    places: [
      { label: "Home", href: "/lab", icon: "home", match: ["/lab$", "/lab/welcome"] },
      { label: "Learn", href: learnHref, icon: "learn", match: LEARN_PATHS },
      { label: "Skills", href: "/lab/skills", icon: "skills", match: ["/lab/skills", "/lab/portfolio"] },
    ],
    next: { label: "Next", href: step?.href ?? "/lab/skills" },
    rail: { course },
  };
}

/**
 * Facilitator dock: Class (the console), Students (cohort progress on the console, and every student page),
 * Coach (the reliability view on the console), and Next, which opens the first "needs you" row.
 * Students and Coach are sections of the console, so they link to its anchors in the facilitator's section.
 */
async function instructorDock(): Promise<Chrome> {
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
    const sectionList: RailList = { title: "Sections", items: sections.map((x) => ({ label: x.name, href: sectionHref(x.id), section: x.id })) };
    if (!sid) return { places, next: null, rail: { lists: [sectionList] } };
    const overview = await sectionOverview(sid);
    const rows = await needsYouToday(overview);
    const names = new Map(overview.students.map((s) => [s.id, s.display_name]));
    const needs: RailList = {
      title: "Needs you",
      empty: "No one right now",
      items: rows.slice(0, 6).map((r) =>
        r.kind === "class"
          ? { label: `${r.students?.length ?? 0} students stuck`, sub: r.skill ? `Class-wide · ${r.skill}` : "Class-wide", href: `${sectionHref(sid)}#mini-lesson` }
          : { label: names.get(r.student_id) ?? r.student_id, sub: r.headline, href: `${studentHref(r.student_id, r.attempt_id)}#why` },
      ),
    };
    const first = rows[0];
    const rail = { lists: [sectionList, needs], defaultSection: sid };
    if (!first) return { places, next: null, rail };
    const href =
      first.kind === "class"
        ? `${sectionHref(sid)}${first.skill === overview.miniLesson?.skill ? "#mini-lesson" : "#heatmap"}`
        : `${studentHref(first.student_id, first.attempt_id)}#why`;
    return { places, next: { label: "Next", href }, rail };
  } catch {
    return { places: place(undefined), next: null, rail: {} };
  }
}

/** Admin dock: the cost view and its limit log, as anchors on one page. No "Next" button. */
function adminDock(): Chrome {
  return {
    rail: {},
    places: [
      { label: "Cost", href: "/lab/admin", icon: "skills", match: ["/lab/admin", "/lab$"] },
      { label: "Overrides", href: "/lab/admin#overrides", icon: "flag", match: [] },
    ],
    next: null,
  };
}

/**
 * The lab shell: the ground, the top bar, the frozen side rail (1200px and wider), the page, and the dock (narrower
 * screens). Logan brought the rail back on 2026-11-19: the centred single column was hard to navigate.
 * The ground is "study" (calm) on lessons, practice, checks and instructor pages, "show" on the course home and skills.
 */
export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v) redirect("/");
  const p = persona(v.persona);
  const user = { name: v.name, initials: p?.initials ?? v.name.slice(0, 2).toUpperCase(), detail: p?.description ?? "" };
  const dock = v.role === "student" ? await studentDock() : v.role === "admin" ? adminDock() : await instructorDock();

  // The ground image is the first thing painted: fetch it early.
  preload("/materials/ground.webp", { as: "image", fetchPriority: "high" });

  return (
    <Ground>
      <a href="#main" className="ds-skip">
        Skip to content
      </a>
      <TopBar user={user} />
      <div className="ds-frame">
        <SideRail places={dock.places} next={dock.next} {...dock.rail} />
        <main id="main" className="ds-content">
          {children}
        </main>
      </div>
      <Dock places={dock.places} next={dock.next} />
    </Ground>
  );
}
