"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { currentPlace, type DockPlace } from "./Dock";
import { Icon } from "./icons";

/**
 * The frozen left rail of the lab (added 2026-11-19, Logan: the centred page was hard to follow and had no
 * navigation that stays put). Shown from 1200px wide; below that the bottom dock does the same job.
 * It holds, top to bottom: the places, the one "next" button, the context outline (the course for a student,
 * sections and who needs you for a facilitator) and "On this page", built from the page's own h2 headings.
 */

export interface RailStep {
  id: string;
  title: string;
  href: string;
  kind: string;
  state: "done" | "started" | "todo";
}
export interface RailGroup {
  id: string;
  title: string;
  done: number;
  total: number;
  steps: RailStep[];
}
export interface RailListItem {
  label: string;
  sub?: string;
  href: string;
  /** Facilitator sections: matches `?section=` on the console. */
  section?: string;
}
export interface RailList {
  title: string;
  items: RailListItem[];
  empty?: string;
}
export interface RailProps {
  places: DockPlace[];
  next?: { label: string; href: string } | null;
  /** Student: the whole course with each step's status. */
  course?: { done: number; total: number; groups: RailGroup[] };
  /** Facilitator: sections, and who needs you. */
  lists?: RailList[];
  /** The section the console shows when the address has no `?section=`. */
  defaultSection?: string;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

interface Heading {
  id: string;
  text: string;
}

/** The page's own section headings: every h2 in the main area that is not inside the coach panel. */
function PageOutline() {
  const path = usePathname();
  const [items, setItems] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    let frame = 0;
    const scan = () => {
      const seen = new Set<string>();
      const found: Heading[] = [];
      main.querySelectorAll<HTMLHeadingElement>("h2").forEach((h) => {
        if (h.closest("aside, .ds-fold, [hidden]")) return;
        const text = (h.textContent ?? "").trim();
        if (!text) return;
        if (!h.id) {
          let id = `sec-${slug(text) || "part"}`;
          for (let n = 2; seen.has(id) || document.getElementById(id); n++) id = `sec-${slug(text)}-${n}`;
          h.id = id;
        }
        seen.add(h.id);
        found.push({ id: h.id, text });
      });
      setItems((old) => (old.length === found.length && old.every((o, i) => o.id === found[i]!.id && o.text === found[i]!.text) ? old : found));
    };
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    };
    scan();
    const mo = new MutationObserver(later);
    mo.observe(main, { childList: true, subtree: true, characterData: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [path]);

  useEffect(() => {
    if (items.length < 3) return;
    let frame = 0;
    const update = () => {
      let current: string | null = items[0]?.id ?? null;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= 140) current = it.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [items]);

  if (items.length < 3) return null;
  return (
    <nav className="ds-rail-sec" aria-label="On this page">
      <h2 className="ds-rail-h">On this page</h2>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} aria-current={active === it.id ? "location" : undefined}>
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function CourseOutline({ course, nextHref }: { course: NonNullable<RailProps["course"]>; nextHref?: string }) {
  const path = usePathname() ?? "";
  const at = (href: string) => path === href.split("?")[0];
  const pct = course.total ? Math.round((course.done / course.total) * 100) : 0;
  // Open the module you are in. On a page outside the course (home, skills) open the one holding your next step.
  const anyHere = course.groups.some((g) => g.steps.some((s) => at(s.href)));
  return (
    <nav className="ds-rail-sec" aria-label="Course outline">
      <h2 className="ds-rail-h">Course</h2>
      <div className="ds-rail-prog">
        <div className="ds-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Course progress">
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className="ds-num">
          {course.done} of {course.total}
        </span>
      </div>
      {course.groups.map((g) => {
        const here = g.steps.some((s) => at(s.href));
        return (
          <details key={g.id} className="ds-rail-group" open={here || (!anyHere && g.steps.some((s) => s.href === nextHref))} data-here={here ? "" : undefined}>
            <summary>
              <span className="ds-rail-gt">{g.title}</span>
              <span className="ds-rail-gn ds-num">
                {g.done}/{g.total}
              </span>
              <Icon name="down" className="ds-icon ds-chev" />
            </summary>
            <ul>
              {g.steps.map((s) => (
                <li key={s.id}>
                  <Link href={s.href} className="ds-rail-step" aria-current={at(s.href) ? "page" : undefined}>
                    <span className="ds-rail-ic" aria-hidden>
                      {s.state === "done" && <Icon name="check" />}
                    </span>
                    <span>{s.title}</span>
                    <span className="ds-sr">{s.state === "done" ? ", done" : s.state === "started" ? ", started" : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </nav>
  );
}

function RailLists({ lists, defaultSection }: { lists: RailList[]; defaultSection?: string }) {
  const path = usePathname() ?? "";
  const params = useSearchParams();
  const section = params.get("section") ?? defaultSection;
  return (
    <>
      {lists.map((l) => (
        <nav key={l.title} className="ds-rail-sec" aria-label={l.title}>
          <h2 className="ds-rail-h">{l.title}</h2>
          {l.items.length === 0 ? (
            l.empty && <p className="ds-rail-empty">{l.empty}</p>
          ) : (
            <ul>
              {l.items.map((it) => {
                const cur = it.section ? path === "/lab/instructor" && section === it.section : false;
                return (
                  <li key={it.href + it.label}>
                    <Link href={it.href} className="ds-rail-step ds-rail-item" aria-current={cur ? "page" : undefined}>
                      <span>
                        {it.label}
                        {it.sub && <small>{it.sub}</small>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      ))}
    </>
  );
}

export function SideRail({ places, next, course, lists, defaultSection }: RailProps) {
  const path = usePathname() ?? "";
  const at = currentPlace(places, path);
  return (
    <aside className="ds-rail" aria-label="Sidebar">
      <nav className="ds-rail-places" aria-label="Main" data-kmk={'aria-current="page"'} data-kmk-bounce="1.6" data-kmk-key="rail">
        <span className="kmk" aria-hidden />
        {places.map((p, i) => (
          <Link key={p.label} href={p.href} aria-current={i === at ? "page" : undefined}>
            <Icon name={p.icon} className="ds-icon" />
            {p.label}
          </Link>
        ))}
      </nav>
      {next && (
        <Link href={next.href} className="ds-btn ds-sq ds-btn-primary ds-btn-block ds-rail-next" data-testid="rail-next">
          {next.label}
          <Icon name="arrow" />
        </Link>
      )}
      {course && <CourseOutline course={course} nextHref={next?.href} />}
      {lists && lists.length > 0 && (
        <Suspense fallback={null}>
          <RailLists lists={lists} defaultSection={defaultSection} />
        </Suspense>
      )}
      <PageOutline />
    </aside>
  );
}
