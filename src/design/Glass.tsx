/**
 * A dark glass surface. At most three on a screen (top bar, coach, dock). Surfaces inside it are solid steps.
 * Falls back to a solid navy where backdrop-filter is missing.
 */
export function Glass<T extends React.ElementType = "div">({
  as,
  className = "",
  children,
  ...rest
}: { as?: T; className?: string; children?: React.ReactNode } & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "children">) {
  const Tag = (as ?? "div") as React.ElementType;
  return (
    <Tag className={`ds-glass ds-sq ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
