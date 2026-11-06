import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SkillBars } from "@/components/SkillBars";
import { SampleTag } from "@/components/Tags";
import { skillCheck } from "@/lib/curriculum/skill-checks";
import { SKILLS } from "@/lib/curriculum/types";
import { adminClient } from "@/lib/db";
import { checkScoresFrom } from "@/lib/student-data";
import { looksLikeToken, tokenMatches } from "../token";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared AI skills · Year Up United AI Lab",
  robots: { index: false, follow: false },
};

/**
 * PUBLIC, read-only skills page for an internship partner. No sign-in.
 * This is the one place the service role reads for display, because the student chose to share.
 * It selects ONLY: name (shown as first name + last initial), track, and the pass/fail of each
 * skills-check item (to compute per-skill scores and the badge). Attempt text (answers, prompts,
 * instructions, reasoning) and AI outputs are never selected.
 */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? "Student";
  return `${parts[0]} ${parts[parts.length - 1]![0]}.`;
}

async function load(token: string) {
  if (!looksLikeToken(token)) return null;
  const db = adminClient();
  const { data: students } = await db.from("students").select("id, display_name, track");
  const student = (students ?? []).find((s: { id: string }) => tokenMatches(s.id, token)) as
    | { id: string; display_name: string; track: string }
    | undefined;
  if (!student) return null;

  const { data } = await db
    .from("attempts")
    .select("exercise_id, attempt_no, check_results(skill, pass)")
    .eq("student_id", student.id)
    .eq("studio", "check");
  const attempts = ((data ?? []) as { exercise_id: string; attempt_no: number; check_results: { skill: string; pass: boolean }[] | null }[]).map((a) => ({
    exerciseId: a.exercise_id,
    attemptNo: a.attempt_no,
    checks: a.check_results ?? [],
  }));
  const finalIds = skillCheck("final").map((t) => t.id);
  const final = checkScoresFrom(attempts, "final");
  return {
    name: shortName(student.display_name),
    track: student.track,
    start: checkScoresFrom(attempts, "start"),
    final,
    earned: finalIds.every((id) => attempts.some((a) => a.exerciseId === id)) && SKILLS.every((s) => (final[s] ?? 0) >= 0.8),
    tookAny: attempts.length > 0,
  };
}

export default async function SharedSkills({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await load(token);
  if (!p) notFound();

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <Image src="/year-up-united.png" alt="Year Up United" className="brand-logo" width={85} height={28} priority />
            <span className="bar-v" aria-hidden />
            <span>AI Lab</span>
          </span>
          <span className="spacer" />
          <SampleTag />
        </div>
      </header>
      <main className="public-wrap">
        <div className="stack" style={{ gap: 24 }}>
          <div>
            <div className="eyebrow">Shared by the student · Read-only</div>
            <h1>{p.name}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {p.track} track · AI Foundations course
            </p>
          </div>

          <section className="card" data-testid="public-badge" data-earned={p.earned ? "yes" : "no"}>
            <div className="row" style={{ gap: 14, flexWrap: "nowrap" }}>
              <span className={`badge-mark${p.earned ? " earned" : ""}`} aria-hidden>★</span>
              <div>
                <div className="row">
                  <h2 style={{ margin: 0 }}>AI Fluency badge</h2>
                  <span className={`tag ${p.earned ? "tag-pass" : "tag-quiet"}`}>{p.earned ? "Earned" : "In progress"}</span>
                </div>
                <p className="small muted" style={{ margin: "4px 0 0" }}>
                  Earned by scoring 80% or better on all four AI skills in the course&apos;s final check.
                </p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 style={{ marginBottom: 4 }}>AI skills</h2>
            <p className="small muted" style={{ marginBottom: 16 }}>
              Starting point check at the beginning of the course, final check at the end. Same skills, different tasks.
            </p>
            {p.tookAny ? <SkillBars start={p.start} final={p.final} /> : <p className="small" style={{ margin: 0 }}>No skills checks taken yet.</p>}
          </section>

          <p className="tiny muted" style={{ margin: 0 }}>
            Scores are drafted by an AI coach and reviewed by Year Up instructors. The student&apos;s written work is not shown here.
          </p>
        </div>
      </main>
    </>
  );
}
