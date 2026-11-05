/**
 * Messages that suggest distress skip the coach entirely (PRD section 9, "The coach").
 * This runs in code before any Claude call, so a crisis message never gets a lesson tip back,
 * even if the API is down.
 *
 * The phrase list is deliberately narrow and first-person ("kill myself", not "kill the
 * process") to avoid flagging normal IT vocabulary. It is a tripwire, not a classifier:
 * the safety eval checks both directions.
 */

const PATTERNS: RegExp[] = [
  /\bcan(?:no|')?t\s+cope\b/,
  /\bcannot\s+cope\b/,
  /\bcan(?:no|')?t\s+(?:go\s+on|take\s+(?:it|this)\s+any\s*more|do\s+this\s+any\s*more)\b/,
  /\b(?:want|wanna|going)\s+to\s+die\b/,
  /\bkill(?:ing)?\s+myself\b/,
  /\bend\s+(?:it\s+all|my\s+life)\b/,
  /\b(?:hurt|harm)(?:ing)?\s+myself\b/,
  /\bself[\s-]?harm/,
  /\bsuicid/,
  /\bno\s+(?:reason|point)\s+(?:to|in)\s+(?:live|living|going\s+on)\b/,
  /\bi(?:'m|\s+am)\s+not\s+safe\b/,
  /\bnobody\s+would\s+(?:care|miss\s+me)\b/,
  /\bi(?:'m|\s+am)\s+(?:so\s+)?(?:hopeless|worthless)\b/,
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, " ");
}

export function detectDistress(text: string): { flagged: boolean; matched?: string } {
  const t = normalize(text);
  for (const re of PATTERNS) {
    const m = t.match(re);
    if (m) return { flagged: true, matched: m[0] };
  }
  return { flagged: false };
}

/** Sample staff contact. Invented name, labeled as sample in the UI. */
export const STAFF_CONTACT = {
  name: "Angela Brooks",
  role: "Student Support Coordinator (sample contact)",
  email: "student-support@yearup.example",
};

export const DISTRESS_RESPONSE = `It sounds like things might be really hard right now. That matters more than this exercise.

You don't have to handle it alone. ${STAFF_CONTACT.name}, ${STAFF_CONTACT.role}, can talk with you today: ${STAFF_CONTACT.email}. Your instructor has been told someone may need support, without any details of what you wrote.

If you are in danger or thinking about hurting yourself, call or text 988 (Suicide & Crisis Lifeline, US) or 911 now.

Your work is saved. You can come back to it whenever you're ready.`;
