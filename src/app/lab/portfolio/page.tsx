import Link from "next/link";
import { headers } from "next/headers";
import { SampleTag } from "@/components/Tags";
import { EXERCISES } from "@/lib/curriculum/exercises";
import { SKILL_BLURBS, SKILL_LABELS, SKILLS, STUDIO_LABELS } from "@/lib/curriculum/types";
import { pct } from "@/lib/insights";
import { modelLabel } from "@/lib/models";
import { STUDIO_PATHS } from "@/lib/personas";
import { requireRole } from "@/lib/session";
import { myAttempts, mySkillProfile } from "@/lib/student-data";
import { portfolioToken } from "@/app/portfolio/token";
import { CopyLink } from "./CopyLink";

const BADGE_LINE = 0.8;

function str(input: unknown, key: string): string {
  return typeof input === "object" && input && key in input ? String((input as Record<string, unknown>)[key] ?? "") : "";
}

/** Student's own skills portfolio: skill bars, best attempt per exercise, the AI Fluency badge, and a share link. */
export default async function Portfolio() {
  const v = await requireRole("student");
  const [profile, attempts] = await Promise.all([mySkillProfile(), myAttempts()]);

  const best = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) {
    if (a.passed === null || !a.total) continue;
    const cur = best.get(a.exerciseId);
    if (!cur || a.passed / a.total > (cur.passed ?? 0) / (cur.total ?? 1)) best.set(a.exerciseId, a);
  }
  const work = EXERCISES.filter((e) => best.has(e.id));

  const reached = SKILLS.filter((s) => (profile.levels[s].current ?? 0) >= BADGE_LINE);
  const earned = reached.length === SKILLS.length;

  const token = portfolioToken(v.student!.id);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const sharePath = `/portfolio/${token}`;
  const shareUrl = `${proto}://${host}${sharePath}`;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="row">
            <h1 style={{ margin: 0 }}>Skills portfolio</h1>
            <SampleTag />
          </div>
          <p className="muted" style={{ margin: "0.3rem 0 0" }}>
            Your four AI Fluency skills, your best work in each exercise, and a link you can share with an internship partner.
          </p>
        </div>
      </div>

      <div className="grid grid-4">
        {SKILLS.map((s) => {
          const l = profile.levels[s];
          const ok = (l.current ?? 0) >= BADGE_LINE;
          return (
            <div key={s} className="card" data-testid={`portfolio-skill-${s}`}>
              <div className="stat-label">{SKILL_BLURBS[s]}</div>
              <div className="row between">
                <h2 style={{ margin: "0.2rem 0" }}>{SKILL_LABELS[s]}</h2>
                {ok && <span className="tag tag-pass">80%+</span>}
              </div>
              <div className="stat">{pct(l.current)}</div>
              <div className="bar" style={{ margin: "0.4rem 0" }}>
                <span style={{ width: `${Math.round((l.current ?? 0) * 100)}%` }} />
              </div>
              <div className="small muted">
                First attempt: {pct(l.first)}
                {l.current !== null && l.first !== null && l.current > l.first ? ` · up ${Math.round((l.current - l.first) * 100)} points` : ""}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-2">
        <section className="card" data-testid="fluency-badge">
          <div className="stat-label">AI Fluency badge</div>
          {earned ? (
            <>
              <h2 style={{ margin: "0.2rem 0" }}>★ Earned</h2>
              <p className="small" style={{ margin: 0 }}>
                You are at 80% or better on all four skills. It shows on your shared portfolio.
              </p>
            </>
          ) : (
            <>
              <h2 style={{ margin: "0.2rem 0" }}>
                {reached.length} of 4 skills at 80%
              </h2>
              <div className="bar" style={{ margin: "0.4rem 0" }}>
                <span style={{ width: `${(reached.length / 4) * 100}%` }} />
              </div>
              <ul className="small" style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem" }}>
                {SKILLS.filter((s) => !reached.includes(s)).map((s) => {
                  const c = profile.levels[s].current;
                  return (
                    <li key={s}>
                      {SKILL_LABELS[s]}: {c === null ? "not tested yet" : `${pct(c)}, ${Math.ceil((BADGE_LINE - c) * 100)} points to go`}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <section className="card" data-testid="share-box">
          <div className="stat-label">Share with internship partner</div>
          <h2 style={{ margin: "0.2rem 0" }}>Your read-only link</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            Anyone with this link sees your first name and last initial, your track, your four skill scores, your badge status and the titles and scores of your best work. They never see what you wrote.
          </p>
          <CopyLink url={shareUrl} />
          <div className="small" style={{ marginTop: "0.4rem" }}>
            <Link href={sharePath} target="_blank" data-testid="share-preview">
              Preview what they see →
            </Link>
          </div>
        </section>
      </div>

      <section className="card">
        <h2>Best work</h2>
        {work.length === 0 ? (
          <p className="muted">
            No scored attempts yet. Start with <Link href="/lab/prompt-studio">Prompt Studio</Link>.
          </p>
        ) : (
          <div className="stack">
            {work.map((e) => {
              const a = best.get(e.id)!;
              const input = (a as { input?: unknown }).input;
              const text = e.studio === "prompt" ? str(input, "prompt") : e.studio === "agent" ? str(input, "instructions") : str(input, "prompt");
              const picked = e.studio === "arena" ? str(input, "pickedModel") : "";
              const reasoning = e.studio === "arena" ? str(input, "reasoning") : "";
              return (
                <div key={e.id} className="card card-muted" data-testid={`best-${e.id}`}>
                  <div className="row between">
                    <div className="row">
                      <span className="tag tag-info">{STUDIO_LABELS[e.studio]}</span>
                      <b>{e.title}</b>
                    </div>
                    <span className="stat" style={{ fontSize: "1.1rem" }}>
                      {a.passed}/{a.total}
                      <span className="stat-label"> checks · attempt {a.attemptNo}</span>
                    </span>
                  </div>
                  {text && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <div className="small muted">{e.studio === "agent" ? "Your bot instructions" : "Your prompt"}</div>
                      <pre>{text}</pre>
                    </div>
                  )}
                  {e.studio === "arena" && (picked || reasoning) && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <div className="small muted">Your pick{picked ? `: ${modelLabel(picked)}` : ""}</div>
                      {reasoning && <pre>{reasoning}</pre>}
                    </div>
                  )}
                  <div className="small" style={{ marginTop: "0.4rem" }}>
                    <Link href={`${STUDIO_PATHS[e.studio]}?ex=${e.id}`}>Open in {STUDIO_LABELS[e.studio]} →</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
