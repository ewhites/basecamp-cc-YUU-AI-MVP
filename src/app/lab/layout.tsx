import { redirect } from "next/navigation";
import { Syllabus } from "@/components/Syllabus";
import { Topbar } from "@/components/Topbar";
import { COURSE } from "@/lib/curriculum/course";
import { persona } from "@/lib/personas";
import { myProgress } from "@/lib/progress";
import { getViewer } from "@/lib/session";

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v) redirect("/");
  const p = persona(v.persona);
  const user = { name: v.name, initials: p?.initials ?? v.name.slice(0, 2).toUpperCase(), detail: p?.description ?? "" };

  if (v.role !== "student") {
    return (
      <>
        <Topbar user={user} crumb="AI Foundations · Instructor" />
        <main className="page">{children}</main>
      </>
    );
  }
  const progress = await myProgress();
  return (
    <>
      <Topbar user={user} crumb="AI Foundations" />
      <div className="player">
        <Syllabus groups={COURSE} states={progress.states} done={progress.done} total={progress.total} />
        <main className="player-main">
          <div className="content">{children}</div>
        </main>
      </div>
    </>
  );
}
