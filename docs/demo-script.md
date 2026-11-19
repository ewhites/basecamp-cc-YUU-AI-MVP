# Demo script (about 8 minutes)

Before you start: open the Vercel address (or `npm run dev` with an API key in `.env.local`, then http://localhost:3000).

**0. Say what's simulated first (10 seconds).** "Everything you'll see is sample data. The Year Up sign-in is simulated, and every screen says so."

**1. The problem (one line).** About 1,800 WCR students a cohort need to practice AI skills against a live model, with feedback, on token-based access instead of per-seat licenses. Nothing today records their work or measures the lift.

**2. Jasmine signs in.** Pick **Jasmine Carter**. Her first visit is one question a screen: a welcome, the acceptable-use notice (the coach can be wrong, no personal or confidential data, use is logged with a daily limit), the kind of work she does, her AI experience, and where to start: she picks **Check where I am**.

**3. Starting point check (not graded).** Five short tasks, one per skill: prompting, validation, context engineering, comparing models and responsible use. Answer one, for example "Judge an AI draft": the AI summary says laptops are replaced every 3 years; the policy says 4. The coach panel on the right checks the answer, quotes Jasmine's own words as evidence, and gives one tip. "It isn't graded. It's the baseline we measure the lift against."

**4. The course home.** The progress bar across the course, "Up next", the three module doors (a finished module's door lights up), and every lesson as a row with its status.

**5. Module 1 lesson.** Open **The R-T-G pattern**. A worked example comes first, with Role, Task and Guardrails marked. **Watch demo** plays a scripted run with no model call. The coach chat sits beside the lesson and nudges instead of answering. Click **Start practice**.

**6. Prompt Studio practice.** Paste a weak prompt:

> You are a help-desk lead. Summarize the ticket below for the next-shift technician. Use only the ticket text and don't guess. Leave out names, phone numbers and employee IDs.

The format check fails and the tip says what to add, without writing it for her. Add "in 5 bullet points under 80 words" and run it again: the score goes up and the step is done. Type a phone number into the box to show the personal-data warning.

**7. Model Arena in one breath.** Module 2: one prompt on Haiku, Sonnet and Opus side by side (time and estimated cost), pick one and say why using Fit, Trust and Cost.

**8. Agent Builder sandbox.** Module 3: two scripted demos (a research assistant and a travel planner) show an agent using pretend tools (spreadsheet, outbox, notes doc, memory) and waiting for a person to approve what it sends. Then Jasmine builds her own: a job, limits, a stop rule, a handoff, and only the tools it needs.

**9. How it works.** From the initials menu: access and history, the tool sandbox, tokens and cost.

**10. Ms. Rivera, facilitator.** Sign out from the initials menu and pick **Ms. Rivera**. Section B opens:
- **Needs you today:** each row is a student, the task they're stuck on, and the check they keep missing. Rashad Zhang, Maya Tran and Fatima Jackson are stuck on Prompting. Click **See where they're stuck**: the coach's draft is in the side panel, and she can override any check with a note (logged). She can also raise one student's daily limit, with a reason (logged).
- **Teach next:** the most-missed check with its 10-minute mini-lesson.
- **Starting point to final check:** the section's lift per skill against the 25% goal.
- **Release scores:** students see a score only after she releases it.
- **Cohort progress** by lesson and by student.
- **Coach reliability:** agreement with human graders on held-out checks, and the safety cases.

**11. Sam Lee, admin.** Sign out and pick **Sam Lee**. The cost view: spend this month against the cohort budget (alerts at 50%, 80% and 100%), spend per student, tokens by model, cache hit rate, active students, top lessons, and the log of limit changes. Totals only, never what students wrote.

**12. Close on cost.** Grading runs on Haiku, the cheapest model that passes the eval. The design spec estimates one curriculum run for 1,800 students at about $20 on Haiku and $410 on Sonnet, against about $72K a cohort for $10 per-seat licenses.
