import Link from "next/link";
import { PERSONAS } from "@/lib/personas";
import { SampleTag, SimulatedTag } from "./Tags";

/** The Brightspace navbar + course minibar. Purely visual: there is no real Brightspace here. */
export function BrightspaceChrome({
  links,
  active,
  user,
  showSwitcher = true,
}: {
  links: { href: string; label: string }[];
  active?: string;
  user?: { name: string; role: string } | null;
  showSwitcher?: boolean;
}) {
  return (
    <header className="d2l-navbar">
      <div className="d2l-navbar-top">
        <Link href="/" className="d2l-org" style={{ textDecoration: "none" }}>
          <span className="d2l-org-logo" aria-hidden>
            YU
          </span>
          <span>Year Up United</span>
        </Link>
        <span className="d2l-course">AI Foundations · Fall 2026</span>
        <span className="d2l-navbar-spacer" />
        <SampleTag />
        <SimulatedTag what="Brightspace" />
        {showSwitcher && (
          <details style={{ position: "relative" }}>
            <summary className="btn btn-subtle" style={{ listStyle: "none" }} data-testid="role-switcher">
              {user ? `${user.name} · ${user.role}` : "Demo: sign in as…"} ▾
            </summary>
            <div className="card" style={{ position: "absolute", right: 0, top: "2.6rem", zIndex: 20, minWidth: 280, padding: "0.5rem" }}>
              <div className="small muted" style={{ padding: "0.3rem 0.5rem" }}>
                Demo role switcher (simulated Year Up sign-in)
              </div>
              {PERSONAS.map((p) => (
                <a key={p.key} href={`/launch?as=${p.key}`} className="btn btn-subtle" style={{ width: "100%", justifyContent: "flex-start" }}>
                  {p.name} <span className="small muted">· {p.description}</span>
                </a>
              ))}
              {user && (
                <a href="/signout" className="btn btn-subtle" style={{ width: "100%", justifyContent: "flex-start" }}>
                  Sign out
                </a>
              )}
            </div>
          </details>
        )}
      </div>
      <nav className="d2l-minibar" aria-label="Course navigation">
        <div className="d2l-minibar-inner">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={active === l.href ? "active" : ""}>
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
