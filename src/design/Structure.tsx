import Link from "next/link";
import { Icon } from "./icons";

/**
 * Page structure pieces (added 2026-11-19 after Logan found headings and sections running together and
 * clickable things hard to spot). Use them on every page:
 * - Section: one h2 and its content. Put the content in a Panel, so it is clearly "under" the heading.
 * - Panel: the box that holds a section's content. `list` for a list of rows.
 * - RowLink: a row that opens something. The whole row is the link: blue title, chevron at the end.
 * - Fold: secondary detail, closed by default. Blue label and a chevron that turns.
 * - Crumbs: where this page sits, on every page below the top level.
 */

export function Section({
  title,
  id,
  aside,
  desc,
  className = "",
  children,
  ...rest
}: {
  title: React.ReactNode;
  id?: string;
  /** Right side of the heading row: a count or a status. Not a link. */
  aside?: React.ReactNode;
  /** One short line under the heading, only when it prevents a mistake. */
  desc?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "title" | "className" | "children">) {
  const hid = id ? `${id}-h` : undefined;
  return (
    <section id={id} aria-labelledby={hid} className={`ds-section ${className}`.trim()} {...rest}>
      <div className="ds-section-head">
        <h2 id={hid}>{title}</h2>
        {aside !== undefined && aside !== null && <span className="ds-section-aside">{aside}</span>}
      </div>
      {desc && <p className="ds-section-desc">{desc}</p>}
      {children}
    </section>
  );
}

export function Panel<T extends React.ElementType = "div">({
  as,
  list,
  className = "",
  children,
  ...rest
}: { as?: T; list?: boolean; className?: string; children?: React.ReactNode } & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "children">) {
  const Tag = (as ?? "div") as React.ElementType;
  return (
    <Tag className={`ds-panel ds-sq${list ? " is-list" : ""} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

export function RowLink({
  href,
  title,
  meta,
  end,
  className = "",
  ...rest
}: {
  href: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** Right side before the chevron: a status, a number, a time. */
  end?: React.ReactNode;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<typeof Link>, "href" | "title" | "className" | "children">) {
  return (
    <Link href={href} className={`ds-rowlink ${className}`.trim()} {...rest}>
      <span className="ds-rowlink-main">
        <span className="ds-rowlink-title">{title}</span>
        {meta && <span className="ds-rowlink-meta">{meta}</span>}
      </span>
      {end !== undefined && end !== null && <span className="ds-rowlink-end">{end}</span>}
      <Icon name="chev" className="ds-icon ds-chev" />
    </Link>
  );
}

export function Fold({
  label,
  hint,
  open,
  className = "",
  children,
  ...rest
}: {
  /** What is inside, as an action: "Show how this is measured", "All 40 students". */
  label: React.ReactNode;
  hint?: React.ReactNode;
  open?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.DetailsHTMLAttributes<HTMLDetailsElement>, "className" | "children" | "open">) {
  return (
    <details className={`ds-fold ds-sq ${className}`.trim()} open={open} {...rest}>
      <summary>
        <span className="ds-fold-label">
          <b>{label}</b>
          {hint && <span>{hint}</span>}
        </span>
        <Icon name="down" className="ds-icon ds-chev" />
      </summary>
      <div className="ds-fold-body">{children}</div>
    </details>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumbs. The last item is the current page (not a link). */
export function Crumbs({ items, className = "" }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`ds-crumbs ${className}`.trim()}>
      <ol>
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`}>
            {c.href && i < items.length - 1 ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
