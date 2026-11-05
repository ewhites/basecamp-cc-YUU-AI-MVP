import Link from "next/link";
import { redirect } from "next/navigation";
import { SampleTag } from "@/components/Tags";
import { EXERCISES } from "@/lib/curriculum/exercises";
import { SKILL_BLURBS, SKILL_LABELS, SKILLS, STUDIO_LABELS } from "@/lib/curriculum/types";
import { pct } from "@/lib/insights";
import { PERSONAS, STUDIO_PATHS } from "@/lib/personas";
import { getViewer } from "@/lib/session";
import { myAttempts, mySkillProfile } from "@/lib/student-data";

/** Student home: progress across the four fluency skills, next lesson, streak, badges. Staff go to their own home. */
export default async function LabHome() {
  const v = await getViewer();
  if (!v) redirect("/");
  if (v.role !== "student") redirect(PERSONAS.find((p) => p.role === v.role)?.landing ?? "/");

  const [profile, attempts] = await Promise.all([mySkillProfile(), myAttempts()]);
  const done = new Set(attempts.filter((a) => a.status === "scored" && a.passed !== null && a.total !== null && a.passed / a.total >= 0.8).map((a) => a.exerciseId));
  const next = EXERCISES.find((e) => !done.has(e.id));
  const pending = attempts.filter((a) => a.status === "pending_score").length;
  const badges = [
    { name: "First prompt", earned: attempts.some((a) => a.exerciseId.startsWith("ps-")) },
    { name: "Fair judge", earned: attempts.some((a) => a.exerciseId.startsWith("ma-") && (a.passed ?? 0) >= 5) },
    { name: "Bot builder", earned: attempts.some((a) => a.exerciseId.startsWith("ab-") && (a.passed ?? 0) >= 6) },
    { name: "AI Fluency badge", earned: SKILLS.every((s) => (profile.levels[s].current ?? 0) >= 0.8) },
  ];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="row">
            <h1 style={{ margin: 0 }}>Welcome back, {v.student?.display_name.split(" ")[0]}</h1>
            <SampleTag />
          </div>
          <p className="muted" style={{ margin: "0.3rem 0 0" }}>
            {v.student?.track} track · Section {v.student?.section_id} · Your ID in the Lab: <code>{v.student?.id}</code> (the only ID the AI sees)
          </p>
        </div>
        {next && (
          <Link href={`${STUDIO_PATHS[next.studio]}?ex=${next.id}`} className="btn btn-primary" data-testid="next-step">
            Next: {next.title} →
          </Link>
        )}
      </div>

      {pending > 0 && (
        <div className="notice notice-info">
          {pending} attempt{pending === 1 ? " is" : "s are"} saved and waiting for the coach. They are scored automatically when the coach is available.
        </div>
      )}

      <div className="grid grid-4">
        {SKILLS.map((s) => {
          const l = profile.levels[s];
          return (
            <div key={s} className="card" data-testid={`skill-${s}`}>
              <div className="stat-label">{SKILL_BLURBS[s]}</div>
              <h2 style={{ margin: "0.2rem 0" }}>{SKILL_LABELS[s]}</h2>
              <div className="stat">{pct(l.current)}</div>
              <div className="bar" style={{ margin: "0.4rem 0" }}>
                <span style={{ width: `${Math.round((l.current ?? 0) * 100)}%` }} />
              </div>
              <div className="small muted">First attempt: {pct(l.first)}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-3">
        <div className="card">
          <div className="stat-label">Practice streak</div>
          <div className="stat">{profile.streakDays} day{profile.streakDays === 1 ? "" : "s"}</div>
          <div className="small muted">{profile.attempts} coached attempts so far</div>
        </div>
        <div className="card" style={{ gridColumn: "span 2" }}>
          <div className="stat-label">Badges</div>
          <div className="row" style={{ marginTop: "0.4rem" }}>
            {badges.map((b) => (
              <span key={b.name} className={`tag ${b.earned ? "tag-pass" : ""}`} style={b.earned ? {} : { color: "var(--muted)", borderColor: "var(--border)" }}>
                {b.earned ? "★" : "☆"} {b.name}
              </span>
            ))}
          </div>
          <div className="small muted" style={{ marginTop: "0.5rem" }}>
            The AI Fluency badge needs 80% or better on all four skills. <Link href="/lab/portfolio">See your portfolio</Link>
          </div>
        </div>
      </div>

      <section className="card">
        <h2>Your exercises</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Studio</th>
              <th>Exercise</th>
              <th>Track</th>
              <th>Your best</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {EXERCISES.map((e) => {
              const mine = attempts.filter((a) => a.exerciseId === e.id && a.passed !== null);
              const best = mine.reduce<number | null>((m, a) => Math.max(m ?? 0, (a.passed ?? 0) / (a.total ?? 1)), null);
              return (
                <tr key={e.id}>
                  <td>{STUDIO_LABELS[e.studio]}</td>
                  <td>{e.title}</td>
                  <td className="muted">{e.track}</td>
                  <td>{best === null ? <span className="muted">Not started</span> : pct(best)}</td>
                  <td>
                    <Link href={`${STUDIO_PATHS[e.studio]}?ex=${e.id}`}>{best === null ? "Start" : "Practice again"}</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
