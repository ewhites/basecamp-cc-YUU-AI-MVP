import Link from "next/link";
import { SampleTag } from "./Tags";

/** The Lab's top bar: where you are, the sample-data tag, and your account menu. */
export function Topbar({ user, crumb }: { user: { name: string; initials: string; detail: string }; crumb: string }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/lab" className="brand">
          <span className="brand-mark" aria-hidden>AI</span>
          <span>AI Lab</span>
        </Link>
        <nav className="crumbs" aria-label="Breadcrumb">
          <span className="sep">/</span>
          <Link href="/home">Brightspace</Link>
          <span className="sep">/</span>
          <span>{crumb}</span>
        </nav>
        <span className="spacer" />
        <SampleTag />
        <details className="menu">
          <summary aria-label="Account menu" data-testid="account-menu">
            <span className="avatar" aria-hidden>{user.initials}</span>
          </summary>
          <div className="menu-panel">
            <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--line)", marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>{user.name}</div>
              <div className="tiny muted">{user.detail}</div>
            </div>
            <Link href="/home">Brightspace home</Link>
            <a href="/signout">Sign out</a>
          </div>
        </details>
      </div>
    </header>
  );
}
