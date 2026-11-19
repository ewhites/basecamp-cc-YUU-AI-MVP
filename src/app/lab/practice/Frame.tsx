import { Sheet } from "@/design/Sheet";

/** What the server page hands every practice form: the sheet's head, the task material, and the earlier attempts. */
export interface TaskHead {
  title: string;
  brief: string;
  /** Material, knowledge sheet, test messages, the checklist and the worked-example link (server-rendered). */
  task: React.ReactNode;
  /** Earlier attempts, folded (server-rendered), shown under the latest result in the coach panel. */
  earlier?: React.ReactNode;
  module: string;
}

/** The one page template for a practice task: the sheet (task, then the work) and the coach panel to its right. */
export function Frame({ head, coach, children }: { head: TaskHead; coach: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="ds-work">
      <Sheet className="ds-rise ln-i1" title={head.title} brief={head.brief}>
        {head.task}
        {children}
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
