/**
 * The cream reading sheet: kicker, title, one-line brief, then the material and the work surface,
 * with the one main button at the bottom right (actions).
 * Inside it the colour tokens read as indigo on cream, so every control placed in it adapts.
 */
export function Sheet<T extends React.ElementType = "section">({
  as,
  className = "",
  kicker,
  title,
  brief,
  actions,
  titleId,
  titleAs = "h1",
  children,
  ...rest
}: {
  as?: T;
  className?: string;
  kicker?: React.ReactNode;
  title?: React.ReactNode;
  brief?: React.ReactNode;
  /** The main button (and at most a quiet second one). Sits at the bottom right. */
  actions?: React.ReactNode;
  titleId?: string;
  /** The page title is h1. A second sheet on the same page uses h2. */
  titleAs?: "h1" | "h2";
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "title" | "children">) {
  const Tag = (as ?? "section") as React.ElementType;
  const hasHead = kicker || title || brief;
  const Title = titleAs;
  return (
    <Tag className={`ds-sheet ds-sq ${className}`.trim()} aria-labelledby={title && titleId ? titleId : undefined} {...rest}>
      {kicker && <p className="ds-kicker">{kicker}</p>}
      {title && (
        <Title className="ds-sheet-title" id={titleId}>
          {title}
        </Title>
      )}
      {brief && <p className="ds-brief">{brief}</p>}
      {children && <div className={hasHead ? "ds-sheet-body" : undefined}>{children}</div>}
      {actions && <div className="ds-sheet-actions">{actions}</div>}
    </Tag>
  );
}
