# Handoff: Year Up United AI Lab redesign (2026-11-19)

The redesign moves from Logan's personal Claude account to his Year Up United enterprise Claude account. This file says exactly where the work stands.

## Where things are

| What | Where |
| :-- | :-- |
| Repo on this Mac | `~/Downloads/cc-basecamp-cohort1/CC Basecamp Modules/basecamp-cc-YUU-AI-MVP` (the path has spaces: quote it) |
| Branch | `logan`. All redesign work is here. Not pushed yet at the time of writing (see the last section). |
| GitHub | `ewhites/basecamp-cc-YUU-AI-MVP` (Ethan White's account). `main` is the demo. |
| Vercel | Project `yuu-ai-lab` (linked in `.vercel/project.json`). Pushing `logan` makes a preview deploy. |
| Secrets | `.env.local` holds the Anthropic key and Upstash settings. Never read, print or commit it. Names only: `docs/secrets.md`. |
| Project rules | `CLAUDE.md` (sample data labels, coach rules, never weaken them). Do not push or merge to `main` without asking Logan. |

## What Logan decided (all final, do not reopen)

1. The look is a derivative of the live kaleoshq.com design (olive and walnut "Canopy" design), in Year Up United colours: indigo `#170055`, blue `#007EF2`, orange `#FE6500`.
2. Light reading sheet: anything you read or write on is a cream sheet (`#F2ECE1`, indigo ink). The top bar, dock and coach are dark navy glass.
3. The AI coach is an always-visible side panel on the right (under the work on phones).
4. Every screen is redesigned, the simulated Brightspace page included. Nothing of the old styling is kept.
5. Background: blue linen with two twisting orange marble ribbons; the coach header and the lit module door carry orange marble. Still "modern sleek pristine and techy", and "not overwhelming" because it is a learning platform: study screens use a calmed ground.
6. Fonts and sizes exactly as kaleoshq.com: Fraunces 300 for headings, Hanken Grotesk for the rest.
7. Switches, tabs, checkboxes and the dock stretch and bounce (the shape gets wider, never a sideways scale).
8. First visit follows Duolingo's pattern (one question a screen), not its art or words.
9. No pills, dots, underlines, badges or spare logos. Short copy. Same order on every screen.
10. He does not want to recalibrate until the redesign is finished. Build it without stopping for design questions.

## Read these, in order

1. `docs/redesign/BUILD-PLAN.md`: what must not change, the structure, every screen, phases, proof of done.
2. `docs/redesign/DESIGN-RULES.md`: every token and rule, the materials section, the learning-first rules, sources.
3. `docs/redesign/vision-board.html`: the approved look (open it in a browser; it opens on Logan's picks).
4. `TASKS.md`: the checklist.

## Status

| Phase | State |
| :-- | :-- |
| Vision boards, rules, plan | Done |
| Materials (linen, marble) | Done: `public/materials/*.webp`, made by `scripts/materials/render.mjs` (WebGL shader in headless Chromium). Do not use Logan's reference photos. |
| Phase 1: foundation | **Partly done.** `src/design/` (tokens, base and component CSS, `kmk.ts` elastic marker, TopBar, Dock, Sheet, Glass, Button, Progress, Segmented, Switch, Checkbox, AnswerList, CoachPanel, Ground, icons, AccountMenu), the `/design` gallery, the new lab shell and fonts. Type check, lint (0 errors) and 51 unit tests pass. The agent stopped before: `npm run build`, screenshots, checking the linen and marble ground is wired in (the tokens mention the materials, the CSS may not use them yet), the two ground strengths (show and study), dock dimming while typing, and ticking `TASKS.md`. |
| Phases 2 to 5 | Not started. |

## Next steps

1. Finish Phase 1 using the "Phase 1" list in `BUILD-PLAN.md` plus the materials and learning-first sections of `DESIGN-RULES.md`. Run `npm run build` (needs network for fonts) and take screenshots of `/design`, `/lab` (as Jasmine: `/launch?as=jasmine&next=/lab`) and `/lab/instructor?section=B` (as Rivera: `/launch?as=rivera`) at 1440x900 and 390x844. Compare with the vision board. Commit.
2. Phases 2 to 4 (entry, learning, staff) can run in parallel, each in its own git worktree, merged in order.
3. Phase 5: cleanup, end-to-end test (`npm run test:e2e`), accessibility, docs.
4. Push `logan`, check the Vercel preview, send Logan the preview address. Ask Logan before merging to `main`.

## Notes

- Coach grading code (`src/lib/coach/`) must not change. The redesign is presentation only, so the paid coach evals do not need a rerun.
- Keep every `data-testid`: the end-to-end test and demo script rely on them.
- Logan's general design preferences live in the `logan-design` skill of his kaleos-toolkit plugin (personal account). The ones for this build are copied into `DESIGN-RULES.md`, so the new account does not need the plugin.
