import { Sheet } from "@/design/Sheet";

/** What the server page hands every practice form: the sheet's head, the task material, and the earlier attempts. */
export interface TaskHead {
  title: string;
  brief: string;
  /** Material, knowledge sheet, test messages, the checklist and the worked-example link (server-rendered). */
  task: React.ReactNode;
  /** The live build's test messages: they sit under the instructions in the second column. */
  tests?: React.ReactNode;
  /** Earlier attempts, folded (server-rendered), shown under the latest result in the coach panel. */
  earlier?: React.ReactNode;
  module: string;
}

/**
 * Two columns inside a sheet: what to read on the left, what to do on the right. One column on narrow sheets, same order.
 * `kind` sets the proportions (see learn.css).
 */
export function Split({ kind, a, b, className = "" }: { kind?: "task" | "demo" | "check"; a: React.ReactNode; b: React.ReactNode; className?: string }) {
  return (
    <div className={`ln-split${kind ? ` is-${kind}` : ""} ${className}`.trim()}>
      <div className="ln-col">{a}</div>
      <div className="ln-col">{b}</div>
    </div>
  );
}

/**
 * The one page template for a practice task: the sheet and the coach panel to its right.
 * In the sheet: `lead` (optional, full width), then the task on the left and the work (children) on the right,
 * then `after` (optional, full width: results that need the width, and the Continue row).
 * `beside` sits in the left column under the task (the live build's tool picker).
 */
export function Frame({
  head,
  coach,
  lead,
  beside,
  after,
  children,
}: {
  head: TaskHead;
  coach: React.ReactNode;
  lead?: React.ReactNode;
  beside?: React.ReactNode;
  after?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="ds-work">
      <Sheet className="ds-rise ln-i1" title={head.title} brief={head.brief}>
        {lead}
        <Split
          kind="task"
          a={
            <>
              {head.task}
              {beside}
            </>
          }
          b={
            <>
              {children}
              {head.tests}
            </>
          }
        />
        {after && <div className="ln-full">{after}</div>}
      </Sheet>
      {coach}
    </div>
  );
}

/** The dark write surface: the student's work, a quiet line on the left, the main button bottom right. */
export function Slab({ children, note, action, className = "" }: { children: React.ReactNode; note?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={`ds-slab ds-sq ln-slab ${className}`.trim()}>
      {children}
      {(note || action) && (
        <div className="ln-slab-foot">
          <span className="ln-foot-note" aria-live="polite">
            {note}
          </span>
          {action}
        </div>
      )}
    </div>
  );
}

/** An error line under the work: plain text with an icon, never colour alone. */
export function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="ln-error" role="alert">
      {children}
    </p>
  );
}
