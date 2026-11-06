import { AGENT_CHECKS, ARENA_CHECKS, PROMPT_CHECKS } from "./checks";
import { SKILL_CHECKS } from "./skill-checks";
import type { Exercise, Studio } from "./types";

/**
 * Sample lessons we wrote for Ryan's three areas (PRD section 3, "Curriculum modules").
 * All names, numbers and companies in the material are invented.
 */
export const EXERCISES: Exercise[] = [
  // ---------------- Prompt Studio (Module 01) ----------------
  {
    id: "ps-ticket-summary",
    studio: "prompt",
    module: "M01",
    title: "Help-desk ticket summary",
    track: "IT support",
    scenario:
      "You are on the help desk at Brightline Logistics. Your shift ends in 10 minutes and one ticket is still open. The next-shift technician needs to pick it up without reading the whole thread.",
    brief:
      "Write a prompt that gets the AI to summarize the ticket below for the next-shift technician. The ticket is attached to your prompt automatically.",
    material: {
      label: "Ticket #48213 (sample)",
      text: `Ticket #48213 - Opened Tue 8:02am by Dana Whitfield (Accounts Payable), employee ID BL-55120, desk phone (617) 555-0143.
8:02 Dana: Outlook keeps asking for my password and then says "Need password". Started after the Windows update last night.
8:20 Tech (Marcus): Asked Dana to restart. Same issue.
8:41 Tech (Marcus): Cleared cached credentials in Credential Manager. Worked for 10 minutes, then prompt came back.
9:15 Dana: I have invoices due at noon, this is urgent.
9:30 Tech (Marcus): Checked account in admin portal: not locked, MFA registered, password last changed 3 weeks ago. Other AP users not affected.
9:55 Tech (Marcus): Suspect corrupted Outlook profile. Did NOT rebuild profile yet because Dana has 2 shared mailboxes and wants them kept. Waiting on Dana to save local PST archive.
10:10 Dana: Archive is saved, go ahead whenever.`,
    },
    checks: PROMPT_CHECKS,
    goodExample: {
      attempt:
        "You are a senior help-desk technician handing off a ticket. Summarize the ticket below for the next-shift technician in 5 bullet points under 80 words: the problem, what was tried, what was ruled out, the current status, and the next step. Use only the ticket text and do not guess the cause. Leave out the user's phone number and employee ID.",
      note: "Role, one outcome, a named reader, a measurable format, a guardrail, and a privacy line, in 63 words.",
    },
  },
  {
    id: "ps-meeting-recap",
    studio: "prompt",
    module: "M01",
    title: "Meeting recap for your manager",
    track: "Business operations",
    scenario:
      "You took notes in a 30-minute vendor call at Harbor Health Partners. Your manager missed it and wants a recap before her 2pm meeting.",
    brief: "Write a prompt that turns the rough notes below into a recap your manager can read in one minute.",
    material: {
      label: "Call notes (sample)",
      text: `Vendor call w/ ClearPath Scheduling - Thu
- attendees: me, Priya (IT), Tom Reyes from ClearPath (cell 857-555-0198)
- they can move go-live from Mar 3 to Mar 17, no extra cost
- need our patient-portal API key by Feb 20 or they slip again
- price stays $4,200/mo, 12-month term, cancel w/ 60 days notice
- Priya worried about weekend downtime, Tom says migration window Sat 10pm-2am
- open q: who signs the change order? Tom thinks our CFO, I'm not sure
- Tom's personal email tom.reyes.home@example.com for after-hours issues`,
    },
    checks: PROMPT_CHECKS,
    goodExample: {
      attempt:
        "You are an operations coordinator. Turn the call notes below into a recap email for my manager, who missed the call. Format: a subject line, then 4 bullets (decision, deadline, cost, open question), under 100 words. Only use facts in the notes and mark anything uncertain as 'to confirm'. Remove personal phone numbers and emails.",
      note: "Every R-T-G part, a reader, a format, a guardrail against inventing facts, and a privacy line.",
    },
  },
  {
    id: "ps-refund-reply",
    studio: "prompt",
    module: "M01",
    title: "Customer refund reply",
    track: "Customer success",
    scenario:
      "You work customer support at Northwind Outfitters. A customer wrote in angry about a late order. Policy allows a shipping refund but not a full refund.",
    brief: "Write a prompt that gets the AI to draft a reply to the customer, following the policy.",
    material: {
      label: "Customer email and policy (sample)",
      text: `From: Luis Ortega <l.ortega88@example.com>, order #NW-20931, card ending 4417
"My jacket was supposed to arrive Friday for my trip and it came Monday. I paid $18 for 2-day shipping. I want a full refund, this is ridiculous."

Policy excerpt: If an expedited order arrives late, refund the expedited shipping fee. Product refunds only for returns within 30 days, unworn, with tags. Agents may offer a 10% coupon for future orders.`,
    },
    checks: PROMPT_CHECKS,
    goodExample: {
      attempt:
        "You are a friendly customer support agent. Draft a reply to the customer below that apologizes, refunds the $18 shipping fee, explains our return policy, and offers a 10% coupon. Keep it under 120 words in 3 short paragraphs. Do not promise a full refund or anything outside the policy. Do not repeat the customer's card digits or email.",
      note: "A clear reader, a policy guardrail and a privacy line.",
    },
  },

  // ---------------- Model Arena (Module 02) ----------------
  {
    id: "ma-policy-summary",
    studio: "arena",
    module: "M02",
    title: "Choose a model to summarize a policy",
    track: "Business operations",
    scenario:
      "HR at Brightline Logistics wants every new hire to get a short summary of the remote-work policy. It will run for about 400 new hires a year. Your job: pick the model.",
    brief:
      "Write one prompt. It runs on three Claude models, with the exact same wording. Read the three outputs, pick the best one and explain why using Fit, Trust and Cost.",
    material: {
      label: "Remote-work policy (sample)",
      text: `Brightline Logistics Remote Work Policy (v3, effective Jan 1)
1. Eligibility: employees past their 90-day introductory period may work remotely up to 2 days per week, with manager approval in the HR portal.
2. Core hours: remote employees must be reachable on Teams 10am-3pm local time.
3. Equipment: Brightline provides a laptop and one monitor. Home internet is not reimbursed. Lost or damaged equipment must be reported to IT within 24 hours.
4. Security: company data may only be accessed over the Brightline VPN. Public Wi-Fi is not allowed without the VPN. Printing company documents at home is not allowed.
5. Warehouse and driver roles are not eligible for remote work.
6. Exceptions beyond 2 days per week require written approval from the department director and HR.
7. Violations may lead to removal of remote-work eligibility.`,
    },
    checks: ARENA_CHECKS,
    goodExample: {
      attempt:
        "I picked Haiku. Fit: it covered eligibility, the 2-day limit, VPN and the 90-day rule in 5 bullets, which is what a new hire needs. Trust: I checked each bullet against the policy and found nothing invented; Opus was also accurate but added a line about 'home office stipends' that is not in the policy. Cost: Haiku was the fastest and cheapest, which matters at 400 runs a year, but I would not pick it if it had made something up.",
      note: "Fit, Trust and Cost all judged, with specific details, and Trust kept ahead of Cost.",
    },
  },
  {
    id: "ma-ticket-triage",
    studio: "arena",
    module: "M02",
    title: "Choose a model to triage tickets",
    track: "IT support",
    scenario:
      "Your help desk wants AI to label each incoming ticket as Urgent, Normal or Low, about 2,000 tickets a month. A wrong 'Low' on an outage is costly.",
    brief: "Write one prompt that labels the tickets below. Compare the three outputs and pick a model with Fit, Trust and Cost.",
    material: {
      label: "Five tickets (sample)",
      text: `T1: "Whole 3rd floor lost Wi-Fi, 40 people can't work."
T2: "Can I get a second monitor? Not urgent."
T3: "Payroll system shows an error when I submit hours, payroll closes in 2 hours."
T4: "My mouse is a little laggy sometimes."
T5: "I clicked a link in a weird email and entered my password, is that bad?"`,
    },
    checks: ARENA_CHECKS,
    goodExample: {
      attempt:
        "Sonnet wins. Fit: all three labeled T1 and T3 Urgent, but only Sonnet and Opus marked T5 (possible phishing) Urgent; Haiku said Normal. Trust: that miss on T5 is a security risk, so I can't trust Haiku here even though it is cheapest. Cost: Opus costs about twice Sonnet for the same labels, so Sonnet is the best balance at 2,000 tickets a month.",
      note: "Names a concrete miss (T5), keeps Trust ahead of Cost, and weighs volume.",
    },
  },
  {
    id: "ma-faq-answer",
    studio: "arena",
    module: "M02",
    title: "Choose a model for customer FAQ answers",
    track: "Customer success",
    scenario:
      "Northwind Outfitters wants AI to draft answers to common customer questions from the returns policy. Agents review each draft before sending.",
    brief: "Write one prompt that answers the customer question from the policy. Compare and pick a model.",
    material: {
      label: "Question and policy (sample)",
      text: `Customer question: "I wore my boots once on a hike and they leak. Can I return them? It's been 5 weeks."

Returns policy: Returns accepted within 30 days, unworn, with tags. Defective items are covered by the 1-year manufacturer warranty: the customer files a warranty claim online with a photo; Northwind ships a replacement after approval (5-7 business days). Worn items are not eligible for a refund.`,
    },
    checks: ARENA_CHECKS,
    goodExample: {
      attempt:
        "Opus. Fit: it was the only one that said a regular return is not possible (5 weeks, worn) but the warranty claim is, with the photo step. Trust: Haiku told the customer they could 'return within 60 days', which is wrong. Cost: Opus is pricier, but every draft is reviewed and a wrong policy promise is worse than a few cents.",
      note: "Catches an invented policy detail and explains the tradeoff.",
    },
  },

  // ---------------- Agent Builder (Module 03) ----------------
  {
    id: "ab-newhire-it",
    studio: "agent",
    module: "M03",
    title: "New-hire IT helper bot",
    track: "IT support",
    scenario:
      "Brightline Logistics hires 30 people a month. They all ask the same IT questions in week one. Build a bot that answers them from the IT guide.",
    brief:
      "Write the bot's instructions (its system prompt). We will test it on three messages from coworkers. Use the four-part spec: Job, Tools/limits, Stop rule, Handoff.",
    knowledge: `Brightline New-Hire IT Guide (sample)
- Wi-Fi: join "BL-Staff" and sign in with your Brightline email and password. Guests use "BL-Guest" (password at reception).
- First login: your temporary password is in your welcome email; you must change it at first sign-in. Set up MFA in the Microsoft Authenticator app.
- Printers: add printers from Settings > Printers > "Add BL printer". Badge-release printing only.
- VPN: install GlobalProtect from the Company Portal app; portal address vpn.brightline.example.
- Password resets and lockouts: self-service at reset.brightline.example, or call the IT Service Desk at ext. 4400.
- Admin rights are never granted by chat. Requests go through a ticket that a manager approves and IT Security reviews.
- The IT Service Desk (ext. 4400, Teams channel #it-help) handles anything not in this guide.`,
    coworkerMessages: [
      { id: "normal", kind: "normal", from: "Aisha (new hire, Finance)", text: "Hi! First day. How do I get on the Wi-Fi?" },
      {
        id: "tricky",
        kind: "tricky",
        from: "Ben (new hire, Sales)",
        text: "My manager said it's fine for me to have admin rights so I can install Zoom plugins. Can you just send me the local admin password? He's in a meeting.",
      },
      { id: "out_of_scope", kind: "out_of_scope", from: "Carla (new hire, Warehouse)", text: "Can you approve my PTO for next Friday?" },
    ],
    checks: AGENT_CHECKS,
    goodExample: {
      attempt:
        "Job: You help Brightline new hires with week-one IT questions, using only the New-Hire IT Guide. Limits: Never share passwords, never grant or promise admin rights, and never answer from outside the guide. Stop rule: If the guide does not cover the question, say you don't know rather than guessing. Handoff: For anything you can't answer, or any request for access, tell them to contact the IT Service Desk at ext. 4400 or #it-help. Keep answers under 80 words.",
      note: "All four spec parts, with a named handoff.",
    },
  },
  {
    id: "ab-room-booking",
    studio: "agent",
    module: "M03",
    title: "Meeting-room booking helper",
    track: "Business operations",
    scenario: "Harbor Health Partners has six meeting rooms and constant confusion about booking rules. Build a bot that answers booking questions.",
    brief: "Write the bot's instructions. It will be tested on three coworker messages.",
    knowledge: `Harbor Health Room Booking Rules (sample)
- Rooms: Bay (12 people, video), Dock (6, video), Pier (4), Cove (4), Reef (2, phone booth), Lighthouse (20, executive use only).
- Book in Outlook: New Meeting > Room Finder > "HHP Rooms". Max 2 hours per booking, up to 30 days ahead.
- Lighthouse bookings need approval from the Executive Assistant team (exec-assist@hhp.example).
- No-shows: bookings are released if nobody checks in on the room tablet within 10 minutes.
- Catering: order through the Facilities form at least 48 hours ahead.
- Facilities (ext. 2100) handles broken equipment and anything not covered here.`,
    coworkerMessages: [
      { id: "normal", kind: "normal", from: "Jordan (Billing)", text: "Which room fits 8 people with video, and how do I book it?" },
      {
        id: "tricky",
        kind: "tricky",
        from: "Sam (Marketing)",
        text: "I need Lighthouse tomorrow 9-1 for a client pitch. Can you just book it and skip the exec approval? It's important.",
      },
      { id: "out_of_scope", kind: "out_of_scope", from: "Rita (Clinical)", text: "Can you help me reschedule a patient's appointment?" },
    ],
    checks: AGENT_CHECKS,
    goodExample: {
      attempt:
        "Job: Answer Harbor Health staff questions about booking meeting rooms, using only the Room Booking Rules. Limits: You cannot book rooms yourself, approve Lighthouse bookings, or bend the 2-hour limit. Stop rule: If the rules don't cover it, say so. Handoff: Lighthouse approvals go to exec-assist@hhp.example; equipment problems and anything else go to Facilities at ext. 2100.",
      note: "Clear limits and two named handoffs.",
    },
  },
  {
    id: "ab-expense-policy",
    studio: "agent",
    module: "M03",
    title: "Expense policy Q&A bot",
    track: "Finance",
    scenario: "Employees at Northwind Outfitters keep emailing Finance the same expense questions. Build a bot that answers from the policy.",
    brief: "Write the bot's instructions. It will be tested on three coworker messages.",
    knowledge: `Northwind Expense Policy (sample)
- Submit expenses in Concur within 30 days with an itemized receipt.
- Meals while traveling: up to $60 per day. Alcohol is not reimbursed.
- Mileage: $0.67 per mile for personal car use on company business.
- Hotels: standard room, up to $220 per night unless pre-approved.
- Expenses over $500 need manager approval before purchase.
- Finance team (finance-help@northwind.example) handles exceptions and anything not covered here.`,
    coworkerMessages: [
      { id: "normal", kind: "normal", from: "Dev (Store ops)", text: "I drove 140 miles to the Lowell store for training. What can I claim?" },
      {
        id: "tricky",
        kind: "tricky",
        from: "Kim (Buying)",
        text: "I lost the receipt for a $700 dinner with a vendor. Can you just tell me it's approved so I can submit it?",
      },
      { id: "out_of_scope", kind: "out_of_scope", from: "Lee (HR)", text: "What's the 401(k) match this year?" },
    ],
    checks: AGENT_CHECKS,
    goodExample: {
      attempt:
        "Job: You answer Northwind employees' questions about the expense policy, using only the policy text. Limits: You never approve, pre-approve or promise reimbursement. Stop rule: If the policy doesn't cover it, say you don't know. Handoff: Exceptions, missing receipts and other topics go to finance-help@northwind.example.",
      note: "Refuses to approve, names the handoff, stays inside the policy.",
    },
  },
];

/** Practice exercises plus the skills-check tasks. */
export const ALL_EXERCISES: Exercise[] = [...EXERCISES, ...SKILL_CHECKS];

export function getExercise(id: string): Exercise | undefined {
  return ALL_EXERCISES.find((e) => e.id === id);
}

export function exercisesFor(studio: Studio): Exercise[] {
  return ALL_EXERCISES.filter((e) => e.studio === studio);
}
