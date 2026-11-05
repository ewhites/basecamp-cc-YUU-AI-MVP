import Link from "next/link";
import { redirect } from "next/navigation";
import { SkillBars } from "@/components/SkillBars";
import { COURSE } from "@/lib/curriculum/course";
import { getViewer } from "@/lib/session";
import { myProgress } from "@/lib/progress";
import { myCheckAnswers } from "@/lib/student-data";

const KIND_LABEL = { check: "Skills check", lesson: "Lesson", practice: "Practice", skills: "Summary" } as const;

/** Course home: one "Up next" action, how the course works, and your starting point once you have one. */
export default async function CourseHome() {
  const v = await getViewer();
  if (!v) redirect("/");
  if (v.role !== "student") redirect("/lab/instructor");

  const [progress, checks] = await Promise.all([myProgress(), myCheckAnswers()]);
  const first = v.student?.display_name.split(" ")[0];
  const fresh = progress.done === 0;
  const next = progress.next;
  const tookStart = progress.states["check-start"]?.done;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <div className="eyebrow">AI Foundations · Fall 2026 · Section {v.student?.section_id}</div>
        <h1>{fresh ? `Welcome, ${first}` : `Welcome back, ${first}`}</h1>
        <p className="muted" style={{ margin: 0 }}>
          Practice three AI skills on real workplace tasks. A Claude coach scores each try and gives you one tip.
        </p>
      </div>

      {next ? (
        <section className="up-next" data-testid="up-next">
          <div>
            <div className="eyebrow">Up next · {KIND_LABEL[next.kind]} · {next.minutes} min</div>
            <h2 style={{ margin: "0 0 4px" }}>{next.title}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {next.id === "check-start"
                ? "Four short tasks. It isn't graded: it shows where you're starting so you can see how far you've come."
                : next.id === "check-final"
                  ? "The same four skills as your starting point, with new tasks. See how far you've come."
                  : COURSE.find((g) => g.steps.some((s) => s.id === next.id))?.blurb}
            </p>
          </div>
          <Link href={next.href} className="btn btn-primary btn-lg" data-testid="next-step">
            {progress.states[next.id]?.started ? "Continue" : "Start"}
          </Link>
        </section>
      ) : (
        <section className="up-next">
          <div>
            <h2 style={{ margin: "0 0 4px" }}>You finished the course</h2>
            <p className="small muted" style={{ margin: 0 }}>See how your skills grew from your starting point.</p>
          </div>
          <Link href="/lab/skills" className="btn btn-primary btn-lg">See your skills</Link>
        </section>
      )}

      {tookStart ? (
        <section className="card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Your starting point</h2>
            <Link href="/lab/skills" className="small">See all your skills</Link>
          </div>
          <SkillBars start={checks.start} final={checks.final} />
        </section>
      ) : (
        <section className="card card-muted">
          <h2>How this course works</h2>
          <ol className="small" style={{ margin: 0, display: "grid", gap: 6 }}>
            <li><b>Starting point check.</b> 10 minutes, not graded.</li>
            <li><b>Three modules.</b> Each starts with a 5-minute lesson and a worked example, then three practice tasks.</li>
            <li><b>Final check.</b> The same skills with new tasks, so you can see your growth.</li>
          </ol>
        </section>
      )}
    </div>
  );
}
