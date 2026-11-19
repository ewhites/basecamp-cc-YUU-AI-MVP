You are taking over a redesign that is already planned and partly built. Do not restart it and do not reopen design decisions.

Project: the Year Up United AI Lab prototype, a Next.js 16 app where Year Up students practice AI skills with a Claude coach and instructors review their work.

Folder on this Mac (the path has spaces, quote it):
~/Downloads/cc-basecamp-cohort1/CC Basecamp Modules/basecamp-cc-YUU-AI-MVP

Branch: logan (all redesign work is committed there; the latest commit is the handoff note). GitHub: ewhites/basecamp-cc-YUU-AI-MVP (Ethan White's repo). Vercel project: yuu-ai-lab (pushing logan makes a preview deploy). The logan branch is pushed to GitHub (commit 97b93d8 and later).

Read these first, in order:
1. CLAUDE.md (project rules; never weaken them)
2. docs/redesign/HANDOFF.md (exactly where the work stands)
3. docs/redesign/BUILD-PLAN.md (structure, every screen, phases, proof of done)
4. docs/redesign/DESIGN-RULES.md (every token and rule)
5. docs/redesign/vision-board.html (open it in a browser: this is the approved look)
6. TASKS.md (checklist)

The goal: a full visual overhaul that is a derivative of Logan's kaleoshq.com design in Year Up United's colours. Light cream reading sheets, dark navy glass for the top bar, dock and coach, the AI coach as an always-visible side panel, a blue linen background with orange marble ribbons (calmer on study screens), Fraunces and Hanken Grotesk at the Kaleos sizes, stretchy switches and tabs, Duolingo-style first visit, no clutter. Every screen is redesigned, including the simulated sign-in and Brightspace pages.

Where it stands: Phase 1 (the design system in src/design/, the /design gallery, the new lab shell) is partly built; type check, lint and unit tests pass. Finish Phase 1 (build, screenshots, wiring the linen and marble ground, the show and study ground strengths, dock dimming while typing), then Phases 2 to 5 as BUILD-PLAN.md describes. Look at real screenshots at 1440x900 and 390x844 and compare them with the vision board before calling a screen done.

Rules:
- Presentation only. Do not change src/lib/coach/ or the data layer, and keep every data-testid.
- Keep "Sample data" and "Simulated" labels on every screen.
- Never read, print or commit .env files.
- Do not push or merge to main without asking Logan. Push logan and send him the Vercel preview address when the redesign is done.
- Logan wants the redesign finished without stopping for design questions. Ask only for things only he can decide.
- Write to Logan in plain English, no em dashes, and end each report with three headings: Blocked on me, Changed, Found.
