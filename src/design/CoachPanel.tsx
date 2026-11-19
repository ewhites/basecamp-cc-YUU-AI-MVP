import { Glass } from "./Glass";
import { Icon } from "./icons";

/**
 * The coach side panel: the one warm element on a screen. A shell for Phase 3 to fill.
 * Header with the score, a slot for the checks (children, usually <CoachCheck> rows), one tip, and the ask box.
 * When `scored` turns on, the checks arrive 180ms apart and the tip after them. Reduced motion shows them at once.
 */
export function CoachPanel({
  heading = "Coach",
  score,
  scored = true,
  empty,
  tip,
  ask,
  children,
  className = "",
  ...rest
}: {
  heading?: React.ReactNode;
  /** For example "3 of 4". */
  score?: React.ReactNode;
  /** False hides the checks and the tip, so they can arrive when it turns true. */
  scored?: boolean;
  /** One line shown when there are no checks yet. */
  empty?: React.ReactNode;
  /** The one tip. */
  tip?: React.ReactNode;
  /** The ask box, usually <CoachAsk>. */
  ask?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Glass as="aside" aria-label="Coach" className={`ds-coach${scored ? " is-scored" : ""} ${className}`.trim()} {...rest}>
      <div className="ds-coach-head">
        <h2>{heading}</h2>
        {score !== undefined && score !== null && <span className="ds-coach-score">{score}</span>}
      </div>
      {children ? <div className="ds-coach-checks">{children}</div> : empty ? <p className="ds-coach-empty">{empty}</p> : null}
      {tip && (
        <div className="ds-tip">
          <small>One tip</small>
          <p>{tip}</p>
        </div>
      )}
      {ask}
    </Glass>
  );
}

/**
 * One check in the coach panel. pass shows a tick; a missing check shows a minus, its label in light orange,
 * so it never relies on colour alone. quote is the student's own words. n is its place in the list (sets the delay).
 */
export function CoachCheck({
  pass,
  label,
  quote,
  n = 0,
  className = "",
  style,
  ...rest
}: { pass: boolean; label: React.ReactNode; quote?: React.ReactNode; n?: number; className?: string } & Omit<React.HTMLAttributes<HTMLDivElement>, "className">) {
  return (
    <div className={`ds-coach-check ${className}`.trim()} data-state={pass ? "pass" : "fail"} style={{ ...style, "--n": n } as React.CSSProperties} {...rest}>
      <Icon name={pass ? "check" : "minus"} />
      <b>
        <span className="ds-sr">{pass ? "Met: " : "Missing: "}</span>
        {label}
      </b>
      {quote && <q>{quote}</q>}
    </div>
  );
}

/** The ask box at the foot of the coach panel. Pass form props (action, onSubmit) to wire it up. */
export function CoachAsk({
  placeholder = "Ask about this lesson",
  name = "question",
  disabled,
  inputProps,
  className = "",
  ...rest
}: {
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  className?: string;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, "className">) {
  return (
    <form className={`ds-ask ${className}`.trim()} {...rest}>
      <input type="text" name={name} placeholder={placeholder} aria-label={placeholder} autoComplete="off" disabled={disabled} {...inputProps} />
      <button type="submit" aria-label="Ask" disabled={disabled}>
        <Icon name="arrow" />
      </button>
    </form>
  );
}
