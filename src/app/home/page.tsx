import Link from "next/link";
import { redirect } from "next/navigation";
import { SampleTag, SimulatedTag } from "@/components/Tags";
import { ALL_STEPS } from "@/lib/curriculum/course";
import { mySections, sectionOverview } from "@/lib/instructor-data";
import { persona } from "@/lib/personas";
import { myProgress } from "@/lib/progress";
import { getViewer } from "@/lib/session";

/** SIMULATED Brightspace homepage, close to the real D2L layout. The AI Lab opens from the course tile. */
export default async function BrightspaceHome() {
  const v = await getViewer();
  if (!v) redirect("/");
  const p = persona(v.persona);
  const isStudent = v.role === "student";

  let todo: { href: string; title: string; detail: string }[] = [];
  let tiles: { href: string; title: string; detail: string }[] = [];
  if (isStudent) {
    const prog = await myProgress();
    // The next two steps not done yet, in course order.
    todo = ALL_STEPS.filter((st) => !prog.states[st.id]?.done)
      .slice(0, 2)
      .map((st) => ({ href: st.href, title: st.title, detail: `AI Foundations · AI Lab · ${st.minutes} min` }));
    tiles = [{ href: "/lab", title: "AI Foundations", detail: `Fall 2026 · Section B · ${prog.done} of ${prog.total} steps done` }];
  } else {
    const sections = await mySections();
    const overviews = await Promise.all(sections.map(async (s) => ({ s, o: await sectionOverview(s.id) })));
    todo = overviews
      .filter(({ o }) => o.flags.length > 0)
      .map(({ s, o }) => ({
        href: `/lab/instructor?section=${s.id}`,
        title: `${o.flags.length} ${o.flags.length === 1 ? "student needs" : "students need"} help in ${s.name}`,
        detail: "AI Foundations · AI Lab",
      }));
    tiles = sections.map((s) => ({ href: `/lab/instructor?section=${s.id}`, title: `AI Foundations · ${s.name}`, detail: "Fall 2026 · Open the AI Lab console" }));
  }

  const announcement = isStudent
    ? { title: "The AI Lab is open", body: "Start with the 10-minute starting point check. It isn't graded: it shows you and your instructor where you're starting, so you can see how far you've come at the end." }
    : { title: "AI Lab: Module 1 is live", body: "Students start with a 10-minute starting point check, then Module 1. The coach drafts every score; nothing reaches the gradebook until you release it." };

  return (
    <div className="bs">
      <header className="bs-nav">
        <div className="bs-nav-inner">
          <Link href="/home" className="bs-logo">
            <b>YEAR UP</b>
            <span className="bar-v" />
            <span style={{ color: "#494c4e" }}>Brightspace</span>
          </Link>
          <span className="spacer" />
          <SimulatedTag what="Brightspace" />
          <details className="menu">
            <summary data-testid="account-menu">
              <span className="bs-avatar" style={{ width: 34, height: 34, borderRadius: "50%", fontSize: 13, background: isStudent ? "#8a1f53" : "#1d5f8f" }} aria-hidden>
                {p?.initials}
              </span>
              <span style={{ fontSize: 15 }}>{v.name}</span>
            </summary>
            <div className="menu-panel">
              <a href="/signout">Sign out</a>
            </div>
          </details>
        </div>
      </header>
      <nav className="bs-minibar" aria-label="Brightspace">
        <div className="bs-minibar-inner">
          <Link href="/home" style={{ fontWeight: 700, borderBottom: "3px solid #006fbf", paddingBottom: 11, marginTop: 14 }}>My Home</Link>
          <Link href={isStudent ? "/lab" : tiles[0]?.href ?? "/lab/instructor"}>AI Lab</Link>
        </div>
      </nav>
      <main className="bs-main">
        <div className="bs-banner">Welcome, {isStudent ? v.name.split(" ")[0] : v.name}</div>
        <div className="bs-grid">
          <div>
            <section className="bs-widget">
              <div className="bs-widget-title">My Courses</div>
              <div className="bs-course">
                {tiles.map((t) => (
                  <Link key={t.href} href={t.href} className="bs-tile" data-testid="course-tile">
                    <div className="bs-tile-img" />
                    <div className="bs-tile-body">
                      <b>{t.title}</b>
                      <small>{t.detail}</small>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
            <section className="bs-widget">
              <div className="bs-widget-title">Announcements</div>
              <h2 className="bs-h">{announcement.title}</h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>{announcement.body}</p>
              <p style={{ color: "#6e7477", fontSize: 14, margin: "10px 0 0" }}>Posted by Ms. Rivera · Mon, Nov 2</p>
            </section>
          </div>
          <section className="bs-widget">
            <div className="bs-widget-title">Work To Do</div>
            <div className="bs-section">
              <span>{isStudent ? "Up next" : "Needs you"}</span>
              <span className="bs-count">{todo.length}</span>
            </div>
            {todo.length === 0 && <p style={{ color: "#6e7477", margin: 0 }}>You&apos;re all caught up.</p>}
            {todo.map((t) => (
              <div key={t.href + t.title} className="bs-item">
                <span aria-hidden style={{ width: 24, height: 24, borderRadius: 4, background: "#e6f2fa", display: "grid", placeItems: "center", color: "#006fbf", fontSize: 13 }}>●</span>
                <div>
                  <Link href={t.href}>{t.title}</Link>
                  <small>{t.detail}</small>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12 }}><SampleTag /></div>
          </section>
        </div>
      </main>
    </div>
  );
}
