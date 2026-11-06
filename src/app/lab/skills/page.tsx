import Link from "next/link";
import { headers } from "next/headers";
import { SkillBars } from "@/components/SkillBars";
import { COURSE } from "@/lib/curriculum/course";
import { skillCheck } from "@/lib/curriculum/skill-checks";
import { SKILL_LABELS, SKILLS } from "@/lib/curriculum/types";
import { myProgress } from "@/lib/progress";
import { requireRole } from "@/lib/session";
import { myCheckAnswers } from "@/lib/student-data";
import { portfolioToken } from "@/app/portfolio/token";
import { CopyLink } from "./CopyLink";

const BADGE_LINE = 0.8;
const pct = (x: number) => `${Math.round(x * 100)}%`;

type Todo = { key: string; text: React.ReactNode; href: string; action: string };

/** The student's skills: starting point to final check, practice per module, the AI Fluency badge, and a share link. */
export default async function SkillsPage() {
  const v = await requireRole("student");
  const [checks, progress] = await Promise.all([myCheckAnswers(), myProgress()]);

  const finalTasks = skillCheck("final");
  const finalAnswered = finalTasks.filter((t) => checks.latest[t.id]).length;
  const finalDone = finalAnswered === finalTasks.length;
  const tookStart = skillCheck("start").some((t) => checks.latest[t.id]);
  const earned = finalDone && SKILLS.every((s) => (checks.final[s] ?? 0) >= BADGE_LINE);

  // Exactly what's left for the badge, in the order to do it.
  const todo: Todo[] = [];
  if (!finalDone) {
    const firstOpen = finalTasks.findIndex((t) => !checks.latest[t.id]);
    todo.push({
      key: "final",
      text: <><b>Final check:</b> {finalAnswered === 0 ? "not taken yet." : `${finalAnswered} of ${finalTasks.length} tasks answered.`}</>,
      href: finalAnswered === 0 ? "/lab/check/final" : `/lab/check/final?task=${firstOpen + 1}`,
      action: finalAnswered === 0 ? "Take the final check" : "Continue the final check",
    });
  }
  finalTasks.forEach((t, i) => {
    const a = checks.latest[t.id];
    if (!a) return;
    const skill = t.checks[0]!.skill;
    const score = checks.final[skill];
    const href = `/lab/check/final?task=${i + 1}`;
    if (a.status === "pending_score") {
      todo.push({ key: skill, text: <><b>{SKILL_LABELS[skill]}:</b> your answer is waiting for the coach to score it.</>, href, action: `See task ${i + 1}` });
    } else if (score === null) {
      todo.push({ key: skill, text: <><b>{SKILL_LABELS[skill]}:</b> no score yet. Answer the task again.</>, href, action: `Answer task ${i + 1} again` });
    } else if (score < BADGE_LINE) {
      todo.push({ key: skill, text: <><b>{SKILL_LABELS[skill]}:</b> {pct(score)} on the final check. You need 80%.</>, href, action: `Answer task ${i + 1} again` });
    }
  });
  const primary = todo[0];

  const token = portfolioToken(v.student!.id);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const sharePath = `/portfolio/${token}`;

  const modules = COURSE.filter((g) => g.module);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <div className="eyebrow">Finish</div>
        <h1>Your skills</h1>
        <p className="muted" style={{ margin: 0 }}>Where you started, where you are now, and what&apos;s left for your AI Fluency badge.</p>
      </div>

      <section className="card" data-testid="skills-badge" data-earned={earned ? "yes" : "no"}>
        <div className="row" style={{ gap: 14, alignItems: "flex-start", flexWrap: "nowrap" }}>
          <span className={`badge-mark${earned ? " earned" : ""}`} aria-hidden>★</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row">
              <h2 style={{ margin: 0 }}>AI Fluency badge</h2>
              <span className={`tag ${earned ? "tag-pass" : "tag-quiet"}`}>{earned ? "Earned" : "Not yet"}</span>
            </div>
            <p className="small muted" style={{ margin: "4px 0 0" }}>
              {earned
                ? "You scored 80% or better on all four skills in the final check. It shows on your shared link."
                : "Earn it by finishing the final check with 80% or better on all four skills."}
            </p>
          </div>
        </div>
        {!earned && todo.length > 0 && (
          <>
            <hr className="divider" />
            <div className="eyebrow">What&apos;s left</div>
            <ul className="todo">
              {todo.map((t) => (
                <li key={t.key}>
                  {t.text}{" "}
                  {t !== primary && <Link href={t.href}>{t.action}</Link>}
                </li>
              ))}
            </ul>
            {primary && (
              <div style={{ marginTop: 16 }}>
                <Link href={primary.href} className="btn btn-primary" data-testid="skills-next">
                  {primary.action}
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginBottom: 4 }}>Skills</h2>
        <p className="small muted" style={{ marginBottom: 16 }}>
          {finalDone || SKILLS.some((s) => checks.final[s] !== null) ? "Starting point compared with the final check." : "From your starting point check. Your final check will show next to it."}
        </p>
        {tookStart || SKILLS.some((s) => checks.final[s] !== null) ? (
          <SkillBars start={checks.start} final={checks.final} />
        ) : (
          <p className="small" style={{ margin: 0 }}>
            No scores yet. <Link href="/lab/check/start">Take the starting point check</Link> to see where you&apos;re starting.
          </p>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginBottom: 16 }}>Practice</h2>
        <div className="stack" style={{ gap: 20 }}>
          {modules.map((g) => {
            const practice = g.steps.filter((s) => s.kind === "practice");
            const done = practice.filter((s) => progress.states[s.id]?.done).length;
            return (
              <div key={g.id} data-testid={`skills-module-${g.module}`}>
                <div className="row between" style={{ marginBottom: 4 }}>
                  <h3 style={{ margin: 0 }}>{g.title}</h3>
                  <span className="score-quiet">
                    {done} of {practice.length} done
                  </span>
                </div>
                {practice.map((s) => {
                  const st = progress.states[s.id];
                  return (
                    <div key={s.id} className="module-row">
                      <span className={`step-dot${st?.done ? " done" : ""}`} aria-label={st?.done ? "Done" : "Not done"}>
                        {st?.done ? "✓" : ""}
                      </span>
                      <Link href={s.href}>{s.title}</Link>
                      <span className="score-quiet">{st?.best ? `Best ${st.best.passed}/${st.best.total}` : "Not started"}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card" data-testid="share-box">
        <h2 style={{ marginBottom: 4 }}>Share your skills</h2>
        <p className="small muted" style={{ marginBottom: 12 }}>
          Send this read-only link to an internship partner. They see your first name and last initial, your track, your four skill scores and your badge. They never see what you wrote.
        </p>
        <CopyLink url={`${proto}://${host}${sharePath}`} />
        <div className="small" style={{ marginTop: 8 }}>
          <Link href={sharePath} target="_blank" data-testid="share-preview">
            Preview what they see
          </Link>
        </div>
      </section>
    </div>
  );
}
