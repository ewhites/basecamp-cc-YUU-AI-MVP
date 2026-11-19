import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SkillBars } from "@/components/SkillBars";
import { SampleTag } from "@/components/Tags";
import { skillCheck } from "@/lib/curriculum/skill-checks";
import { SKILLS } from "@/lib/curriculum/types";
import { Ground } from "@/design/Ground";
import { Sheet } from "@/design/Sheet";
import { Fold, Panel, Section } from "@/design/Structure";
import { Icon } from "@/design/icons";
import { Badge } from "@/app/lab/skills/Badge";
import { BADGE_LINE, SKILL_COUNT, SKILL_COUNT_WORD } from "@/app/lab/skills/count";
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
    earned: finalIds.every((id) => attempts.some((a) => a.exerciseId === id)) && SKILLS.every((s) => (final[s] ?? 0) >= BADGE_LINE),
    tookAny: attempts.length > 0,
  };
}

export default async function SharedSkills({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await load(token);
  if (!p) notFound();
  const line = `${Math.round(BADGE_LINE * 100)}%`;

  return (
    <Ground strength="show">
      <header className="ds-topbar">
        <div className="ds-topbar-in">
          <span className="ds-brand">
            <span className="ds-logo ds-sq">
              <Image src="/year-up-united.png" alt="Year Up United" width={85} height={28} priority />
            </span>
            <span className="ds-name">AI Lab</span>
          </span>
          <span className="ds-gap" />
          <SampleTag />
        </div>
      </header>
      <main id="main" className="ds-content st-public">
        <div className="ds-page st-page">
          <Sheet className="ds-rise">
            <header className="st-head">
              <div>
                <p className="ds-kicker">Shared by the student · Read-only</p>
                <h1 className="ds-sheet-title">{p.name}</h1>
                <p className="ds-brief">{p.track} track · AI Foundations course</p>
              </div>
            </header>

            <Section
              title="AI Skills badge"
              id="badge"
              data-testid="public-badge"
              data-earned={p.earned ? "yes" : "no"}
              aside={
                <span className="st-goal">
                  <Icon name={p.earned ? "check" : "minus"} />
                  {p.earned ? "Earned" : "In progress"}
                </span>
              }
            >
              <Panel className="st-badge-panel">
                <Badge earned={p.earned} count={SKILL_COUNT} />
                <div className="st-badge-copy">
                  <p>Earned by scoring {line} or better on all {SKILL_COUNT_WORD} AI skills in the course&apos;s final check.</p>
                </div>
              </Panel>
            </Section>

            <Section title="AI skills" id="skills">
              <Panel>{p.tookAny ? <SkillBars start={p.start} final={p.final} /> : <p>No skills checks taken yet.</p>}</Panel>
              <Fold label="How these scores are made">
                <p>The starting point check is at the beginning of the course and the final check is at the end. Same skills, different tasks.</p>
                <p>Scores are drafted by an AI coach and reviewed by Year Up facilitators. The student&apos;s written work is not shown here.</p>
              </Fold>
            </Section>
          </Sheet>
        </div>
      </main>
    </Ground>
  );
}
