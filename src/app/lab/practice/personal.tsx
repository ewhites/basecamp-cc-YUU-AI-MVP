import { scrubPii } from "@/lib/coach/privacy";

/** Reserved example domains and team mailboxes are not a person's details (a bot's handoff contact is expected). */
const SAFE_EMAIL = /^(?:[^@\s]+@(?:[\w-]+\.)*(?:example|test|invalid)(?:\.[a-z]{2,})?|(?:help|helpdesk|it|support|service|volunteer|volunteers|hr|facilities|parking|info|admin|team|office|finance|payroll|benefits|security|desk|frontdesk|ops)@[^@\s]+)$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Employee and student ID shapes: "employee ID 48213", "student #A-1029", "S-B-012". */
const ID = /\b(?:employee|student|staff|emp|badge)\s*(?:id|#|no\.?|number)?\s*[:#]?\s*[A-Z]{0,3}-?\d[\w-]{2,}|\bS-[A-Z]-\d{3}\b/i;

/**
 * True when text looks like personal information (email, phone, SSN-like number, street address,
 * employee or student ID). Uses the same patterns the server strips with (src/lib/coach/privacy.ts, read-only),
 * so the warning and the stripping agree. Client-side hint only: nothing is blocked.
 */
export function looksPersonal(text: string): boolean {
  if (!text.trim()) return false;
  if (ID.test(text)) return true;
  const emails = text.match(EMAIL) ?? [];
  if (emails.some((e) => !SAFE_EMAIL.test(e))) return true;
  const { removed } = scrubPii(text.replace(EMAIL, " "));
  return !!(removed.phone || removed.ssn || removed.card || removed.address);
}

export const PERSONAL_LINE = "This looks like personal information. Remove it before you send.";

/** The one plain line under a field. Renders nothing when the text looks fine. */
export function PersonalWarning({ text, id }: { text: string; id?: string }) {
  if (!looksPersonal(text)) return null;
  return (
    <p className="ln-personal" id={id} role="status">
      {PERSONAL_LINE}
    </p>
  );
}
