import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SampleTag } from "@/components/Tags";
import { EXERCISES } from "@/lib/curriculum/exercises";
import {
  SKILL_BLURBS,
  SKILL_LABELS,
  SKILLS,
  STUDIO_LABELS,
  type Skill,
} from "@/lib/curriculum/types";
import { pct, skillLevels, type CheckRow } from "@/lib/insights";
import { adminClient } from "@/lib/db";
import { looksLikeToken, tokenMatches } from "../token";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared skills portfolio · Year Up United AI Lab",
  robots: { index: false, follow: false },
};

/**
 * PUBLIC, read-only portfolio for an internship partner. No sign-in.
 * This is the one place the service role reads for display, because the student chose to share.
 * It selects ONLY: name (shown as first name + last initial), track, skill percentages, badge status,
 * and best score per exercise. Attempt text (prompts, instructions, reasoning) is never selected.
 */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? "Student";
  return `${parts[0]} ${parts[parts.length - 1]![0]}.`;
}

async function load(token: string) {
  if (!looksLikeToken(token)) return null;
  const db = adminClient();
  const { data: students } = await db
    .from("students")
    .select("id, display_name, track");
  const student = (students ?? []).find((s: { id: string }) =>
    tokenMatches(s.id, token),
  ) as { id: string; display_name: string; track: string } | undefined;
  if (!student) return null;

  const [{ data: checks }, { data: attempts }] = await Promise.all([
    db
      .from("check_results")
      .select(
        "attempt_id, check_key, skill, pass, attempts!inner(student_id, created_at)",
      )
      .eq("attempts.student_id", student.id),
    db
      .from("attempts")
      .select("exercise_id, passed, total")
      .eq("student_id", student.id)
      .not("passed", "is", null),
  ]);
  const rows: CheckRow[] = (
    (checks ?? []) as unknown as {
      attempt_id: string;
      check_key: string;
      skill: Skill;
      pass: boolean;
      attempts: { student_id: string; created_at: string };
    }[]
  ).map((r) => ({
    attempt_id: r.attempt_id,
    check_key: r.check_key,
    skill: r.skill,
    pass: r.pass,
    student_id: r.attempts.student_id,
    created_at: r.attempts.created_at,
  }));
  const lv = skillLevels(rows).get(student.id);
  const levels = Object.fromEntries(
    SKILLS.map((s) => [s, lv?.[s].current ?? null]),
  ) as Record<Skill, number | null>;

  const best = new Map<string, { passed: number; total: number }>();
  for (const a of (attempts ?? []) as {
    exercise_id: string;
    passed: number;
    total: number | null;
  }[]) {
    if (!a.total) continue;
    const cur = best.get(a.exercise_id);
    if (!cur || a.passed / a.total > cur.passed / cur.total)
      best.set(a.exercise_id, { passed: a.passed, total: a.total });
  }
  return {
    name: shortName(student.display_name),
    track: student.track,
    levels,
    best,
  };
}

export default async function SharedPortfolio({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const p = await load(token);
  if (!p) notFound();
  const earned = SKILLS.every((s) => (p.levels[s] ?? 0) >= 0.8);
  const work = EXERCISES.filter((e) => p.best.has(e.id));

  return (
    <>
      <header className="d2l-navbar">
        <div className="d2l-navbar-top">
          <span className="d2l-org">
            <span className="d2l-org-logo" aria-hidden>
              YU
            </span>
            <span>Year Up United AI Lab</span>
          </span>
          <span className="d2l-course">Shared portfolio</span>
          <span className="d2l-navbar-spacer" />
          <SampleTag />
        </div>
      </header>
      <main className="page">
        <div className="stack">
          <div className="page-head">
            <div>
              <div className="row">
                <h1 style={{ margin: 0 }}>{p.name}: AI skills portfolio</h1>
                <SampleTag />
                <span className="tag tag-info">Shared by the student</span>
              </div>
              <p className="muted" style={{ margin: "0.3rem 0 0" }}>
                {p.track} track · Year Up United AI Lab · Read-only view for
                internship partners
              </p>
            </div>
          </div>

          <div
            className={`notice ${earned ? "notice-pass" : "notice-info"}`}
            data-testid="public-badge"
          >
            {earned ? (
              <>
                <b>★ AI Fluency badge earned.</b> 80% or better on all four AI
                Fluency skills.
              </>
            ) : (
              <>
                <b>AI Fluency badge in progress.</b> The badge needs 80% or
                better on all four skills;{" "}
                {SKILLS.filter((s) => (p.levels[s] ?? 0) >= 0.8).length} of 4
                are there so far.
              </>
            )}
          </div>

          <div className="grid grid-4">
            {SKILLS.map((s) => (
              <div key={s} className="card" data-testid={`public-skill-${s}`}>
                <div className="stat-label">{SKILL_BLURBS[s]}</div>
                <h2 style={{ margin: "0.2rem 0" }}>{SKILL_LABELS[s]}</h2>
                <div className="stat">{pct(p.levels[s])}</div>
                <div className="bar" style={{ marginTop: "0.4rem" }}>
                  <span
                    style={{
                      width: `${Math.round((p.levels[s] ?? 0) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <section className="card">
            <h2>Best work</h2>
            {work.length === 0 ? (
              <p className="muted">No scored work yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Studio</th>
                    <th>Exercise</th>
                    <th>Best score</th>
                  </tr>
                </thead>
                <tbody>
                  {work.map((e) => {
                    const b = p.best.get(e.id)!;
                    return (
                      <tr key={e.id}>
                        <td>{STUDIO_LABELS[e.studio]}</td>
                        <td>{e.title}</td>
                        <td>
                          {b.passed}/{b.total} checks ({pct(b.passed / b.total)}
                          )
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="small muted" style={{ marginBottom: 0 }}>
              Scores come from an AI coach and are reviewed by Year Up
              instructors. The student&apos;s own written work is not shown
              here.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
