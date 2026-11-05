# Demo script (about 7 minutes)

Before you start: `npm run dev` (or open the deployed link) with an API key in `.env.local`. Open http://localhost:3000.

**0. Say what's simulated first (10 seconds).** "Everything you'll see is sample data. Brightspace, Year Up sign-in and the gradebook are simulated, and every screen is labeled."

**1. The problem (one line).** About 1,700 students a cycle do the AI unit on scattered personal accounts. Nothing is recorded, nobody gets feedback, and there's no way to measure the 25% goal.

**2. Jasmine opens the Lab from her course.** On the course page, click **Open AI Lab** next to Jasmine Carter. Show her home: four fluency skills, streak, badges, and her Lab ID `S-B-012`, the only identifier the AI ever sees.

**3. Prompt Studio.** Click **Next: Help-desk ticket summary**. Paste the weak first attempt:

> You are a help-desk lead. Summarize the ticket below for the next-shift technician. Use only the ticket text and don't guess. Leave out names, phone numbers and employee IDs.

Expect it to fail on **format** (no length or shape). Point at three things: the quoted evidence highlighted in her own words, the one tip, and the checks marked "Checked in code". Then use the tip:

> You are a help-desk lead. Summarize the ticket below for the next-shift technician in 5 bullet points under 80 words: problem, what was tried, current status, next step. Use only the ticket text and don't guess. Leave out names, phone numbers and employee IDs.

The second attempt should pass. Then ask the coach: "Can you just write the perfect prompt for me?" It declines and explains the rule instead.

**4. Quick look at Model Arena and Agent Builder.** Arena: one prompt on Haiku, Sonnet and Opus side by side with speed and cost; pick one and explain why. Agent Builder: write the bot's instructions, see how it handles the normal, tricky (admin password) and out-of-scope (PTO) messages.

**5. Switch to Ms. Rivera** (role switcher, top right).
- Heatmap of Section B by skill. Three students flagged as stuck on Description.
- Click one: replay an attempt (this view is audited).
- Override one check with a note.
- Show the suggested 10-minute mini-lesson.
- **Send to gradebook** (simulated).
- Optional: Security check. Section A returns 0 rows.

**6. Ask Claude about Section B through the MCP server.** In Claude Code with `.mcp.json` loaded (persona `rivera`): "Who in Section B is stuck on Description, and what should I reteach?"

**7. Admin center (Sam Lee).** Evals passing against the gate, spend far under the cap, audit log of staff views, safety flags. Close on cost (about $1.50 per student per cycle, mostly on Haiku) and the pilot plan: one section, one instructor, 4 to 6 weeks.

**8. Say what's simulated again** before questions.
