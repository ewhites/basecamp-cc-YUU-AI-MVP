import Link from "next/link";
import { Icon } from "./icons";

type Variant = "primary" | "secondary" | "paper" | "quiet";

type Common = {
  /** primary: the one orange main button on a screen. secondary: outlined, every other button. paper: cream, for the dark ground. quiet: text and an arrow, for navigation only. */
  variant?: Variant;
  /** The pressed-down button with a 4px lower edge (first visit). Primary only. */
  lift?: boolean;
  /** Full width. */
  block?: boolean;
  /** Show the arrow icon after the label (always on for quiet). */
  arrow?: boolean;
  className?: string;
  children: React.ReactNode;
};

type AsLink = Common & { href: string } & Omit<React.ComponentPropsWithoutRef<typeof Link>, "href" | "className" | "children">;
type AsButton = Common & { href?: undefined } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function buttonClass({ variant = "primary", lift, block, className = "" }: Pick<Common, "variant" | "lift" | "block" | "className">): string {
  const base = variant === "quiet" ? "ds-quiet" : `ds-btn ds-sq ds-btn-${variant}`;
  return [base, lift && variant === "primary" ? "ds-btn-lift" : "", block ? "ds-btn-block" : "", className].filter(Boolean).join(" ");
}

/** A real link when it has an href, else a real button. Labels are a verb and its object, no trailing period. */
export function Button(props: AsLink | AsButton) {
  const { variant = "primary", lift, block, arrow, className, children } = props;
  const cls = buttonClass({ variant, lift, block, className });
  const inner = (
    <>
      {children}
      {(arrow || variant === "quiet") && <Icon name="arrow" />}
    </>
  );
  if (props.href !== undefined) {
    const { variant: _v, lift: _l, block: _b, arrow: _a, className: _c, children: _ch, href, ...rest } = props;
    void _v; void _l; void _b; void _a; void _c; void _ch;
    return (
      <Link href={href} className={cls} {...rest}>
        {inner}
      </Link>
    );
  }
  const { variant: _v, lift: _l, block: _b, arrow: _a, className: _c, children: _ch, href: _h, type, ...rest } = props;
  void _v; void _l; void _b; void _a; void _c; void _ch; void _h;
  return (
    <button type={type ?? "button"} className={cls} {...rest}>
      {inner}
    </button>
  );
}
