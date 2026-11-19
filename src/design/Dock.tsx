"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

export interface DockPlace {
  label: string;
  href: string;
  icon: IconName;
  /** Path prefixes that belong to this place. A prefix ending in "$" must match exactly. */
  match: string[];
}

/** Which place a path belongs to: the longest matching prefix wins. */
export function currentPlace(places: DockPlace[], path: string): number {
  let best = -1;
  let len = -1;
  places.forEach((p, i) => {
    for (const m of p.match) {
      const exact = m.endsWith("$");
      const base = exact ? m.slice(0, -1) : m;
      const hit = exact ? path === base : path === base || path.startsWith(base.endsWith("/") ? base : base + "/");
      if (hit && base.length > len) {
        best = i;
        len = base.length;
      }
    }
  });
  return best;
}

/**
 * The dock: up to three places and one raised button for the next step. Floats at the bottom centre.
 * The selected place carries aria-current="page" and the elastic marker (needs an <Elastic> ancestor).
 */
export function Dock({ places, next, current, className = "" }: { places: DockPlace[]; next?: { label: string; href: string } | null; current?: string; className?: string }) {
  const path = usePathname() ?? "";
  const at = currentPlace(places, current ?? path);
  return (
    <nav className={`ds-dock ${className}`.trim()} aria-label="Main" data-kmk={'aria-current="page"'} data-kmk-bounce="1.6" data-kmk-key="dock">
      <span className="kmk" aria-hidden />
      {places.map((p, i) => (
        <Link key={p.label} href={p.href} aria-current={i === at ? "page" : undefined}>
          <Icon name={p.icon} className="" />
          {p.label}
        </Link>
      ))}
      {next && (
        <Link href={next.href} className="ds-dock-mid" data-testid="dock-next">
          <span className="ds-orb">
            <Icon name="next" className="" />
          </span>
          {next.label}
        </Link>
      )}
    </nav>
  );
}
