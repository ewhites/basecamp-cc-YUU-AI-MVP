import type { RubricCheck } from "./types";

/**
 * Rubric checks, yes/no, each tied to the sample curriculum (eval/corpus) and to one of the
 * four AI Fluency skills. Shared across the exercises in each studio.
 */

export const PROMPT_CHECKS: RubricCheck[] = [
  {
    key: "role",
    text: "States who the AI is acting as?",
    skill: "description",
    method: "coach",
    evidenceFrom: "attempt",
    guidance:
      "Yes if the prompt gives the AI a role or point of view (for example 'You are a help-desk lead'). M01-S1, the R of R-T-G.",
    miniLesson:
      "Role first (M01-S1). Show two prompts for the same task, one with 'You are a senior help-desk technician' and one without. Run both live and have the class spot what changed in tone and detail. Then pairs rewrite one weak prompt by adding only a role.",
  },
  {
    key: "single_task",
    text: "Asks for one single outcome?",
    skill: "delegation",
    method: "coach",
    evidenceFrom: "attempt",
    guidance:
      "Yes if the prompt asks for one deliverable (a summary, a reply, a list), not several unrelated jobs at once. M01-S1, the T of R-T-G.",
    miniLesson:
      "One outcome per prompt (M01-S1). Put a prompt on screen that asks for three things at once. Have students split it into three prompts and run them. Discuss which split prompt got the best result and why.",
  },
  {
    key: "audience",
    text: "Says who the output is for?",
    skill: "description",
    method: "coach",
    evidenceFrom: "attempt",
    guidance:
      "Yes if the prompt names the reader of the output (for example 'for the next-shift technician', 'for my manager', 'for a customer'). Naming who is sending it does not count.",
    miniLesson:
      "Write for a reader (M01-S4). Run one prompt three times, changing only the reader: a manager, a new hire, a customer. Students compare the three outputs and list what the AI changed. Then each student adds a reader to their last prompt.",
  },
  {
    key: "format",
    text: "Asks for a specific format or length?",
    skill: "description",
    method: "coach",
    evidenceFrom: "attempt",
    guidance:
      "Yes if the prompt sets a concrete shape: bullet points, a word or sentence count, sections, a table, a subject line. 'Short' or 'brief' alone does not count. M01-S4: measurable constraints.",
    miniLesson:
      "Measurable beats polite (M01-S4). Show 'Please write something short' next to 'Write 3 bullet points, under 60 words'. Run both. Students rewrite a vague format line into a measurable one and swap with a partner to check it.",
  },
  {
    key: "done_condition",
    text: "Says what the AI must not do, or what 'done' looks like?",
    skill: "discernment",
    method: "coach",
    evidenceFrom: "attempt",
    guidance:
      "Yes if the prompt includes a guardrail: something the AI must not do (for example 'do not guess the cause', 'use only the ticket text') or a clear finish line. M01-S1, the G of R-T-G; M01-S5 'Guardrails include a done condition'.",
    miniLesson:
      "Guardrails (M01-S1, M01-S5). Show an output where the AI invented a detail. Ask: what one sentence in the prompt would have stopped that? Students add one 'do not' and one 'done when' line to their own prompt.",
  },
  {
    key: "protects_personal_data",
    text: "Keeps personal details out of the output?",
    skill: "diligence",
    method: "coach",
    evidenceFrom: "attempt",
    guidance:
      "The attached material contains personal details (names, phone numbers, employee IDs). Yes only if the prompt tells the AI to leave those out, or to replace them. M01-S6, stop condition 2.",
    miniLesson:
      "Personal data stop condition (M01-S6). Show the sample ticket with the phone number and employee ID highlighted. Ask who could see the summary. Students add one line telling the AI to remove personal details and check the new output.",
  },
  {
    key: "under_200_words",
    text: "Under 200 words?",
    skill: "description",
    method: "code",
    evidenceFrom: "attempt",
    guidance: "Checked in code: the student's prompt (not the attached material) is under 200 words. M01-S5.",
    miniLesson:
      "Shrink (M01-S2, pass 4). Students delete every word from their prompt that does not change the output, re-running after each cut. Goal: the shortest prompt that still passes every check.",
  },
];

export const ARENA_CHECKS: RubricCheck[] = [
  {
    key: "names_pick",
    text: "Names which output they picked and why, in their own words?",
    skill: "discernment",
    method: "coach",
    evidenceFrom: "attempt",
    guidance: "Yes if the reasoning gives at least one reason for the pick that is tied to the task, beyond 'it was better'.",
    miniLesson:
      "Say why (M02-S1). Show two outputs and three student verdicts: 'B is better', 'B is better because it is clearer', 'B is better because it lists the two deadlines new hires need'. Rank them and discuss what makes a reason useful.",
  },
  {
    key: "judges_fit",
    text: "Judges Fit: does the output do the job asked?",
    skill: "discernment",
    method: "coach",
    evidenceFrom: "attempt",
    guidance: "Yes if the reasoning says whether an output actually did the task (covered what was asked, right length or format, right reader). M02-S2 axis 1.",
    miniLesson:
      "Fit first (M02-S2). Give the class the task and one output that is polished but misses half the task. Students list what the task asked for and tick off what the output did. Polish is not Fit.",
  },
  {
    key: "judges_trust",
    text: "Judges Trust: whether the output can be checked or made things up?",
    skill: "discernment",
    method: "coach",
    evidenceFrom: "attempt",
    guidance: "Yes if the reasoning comments on accuracy against the source, invented details, or whether the model flagged uncertainty. M02-S2 axis 2.",
    miniLesson:
      "Trust is the tiebreaker (M02-S2). Hand out an output with one invented detail. Students check it line by line against the source and mark anything not supported. Discuss why a confident wrong answer loses to a careful one.",
  },
  {
    key: "considers_cost",
    text: "Considers Cost: money, time or speed?",
    skill: "delegation",
    method: "coach",
    evidenceFrom: "attempt",
    guidance: "Yes if the reasoning weighs price, speed or effort as a factor. M02-S2 axis 3.",
    miniLesson:
      "Cost is money, time and access (M02-S2). Show the Arena's cost and speed columns. Ask: if this task runs 500 times a week, which model would you pick and what would you give up? Students write one sentence weighing cost against Fit.",
  },
  {
    key: "trust_tiebreak",
    text: "Does not let Cost outweigh Trust?",
    skill: "diligence",
    method: "coach",
    evidenceFrom: "attempt",
    guidance:
      "No if the reasoning picks an output mainly because it is cheaper or faster while admitting it is less accurate or less checkable. Yes otherwise, including when cost is not mentioned. M02-S2: Trust is the tiebreaker, not Cost.",
    miniLesson:
      "Trust before Cost (M02-S2). Present a cheap model that invented a policy date and an expensive one that did not. Vote, then reveal the module rule. Students rewrite a verdict that picked on cost alone.",
  },
  {
    key: "cites_detail",
    text: "Points to a specific detail in the outputs?",
    skill: "discernment",
    method: "coach",
    evidenceFrom: "attempt",
    guidance: "Yes if the reasoning quotes or names a concrete detail from one of the outputs (a phrase, a missing item, a wrong fact) to back the judgment.",
    miniLesson:
      "Evidence, not vibes. Students must back every verdict with one quote from an output. Practice: give three outputs and have each student write one evidence-backed sentence per output.",
  },
];

export const AGENT_CHECKS: RubricCheck[] = [
  {
    key: "job",
    text: "Instructions state the bot's one job?",
    skill: "delegation",
    method: "coach",
    evidenceFrom: "attempt",
    guidance: "Yes if the instructions say in a sentence what the bot is for and who it serves. M03-S2 part 1 (Job).",
    miniLesson:
      "One job (M03-S2). Show a bot whose instructions try to do everything. Students rewrite its Job as one sentence, one outcome, then test it on one question it should and one it should not answer.",
  },
  {
    key: "limits",
    text: "Instructions say what the bot must not do?",
    skill: "diligence",
    method: "coach",
    evidenceFrom: "attempt",
    guidance: "Yes if the instructions set limits: things it must not do, share or access (for example 'never share passwords', 'only answer from the IT guide'). M03-S3, M03-S5.",
    miniLesson:
      "Smallest tool set and hard limits (M03-S3, M03-S5). List everything the bot could do; strike anything where you cannot name a failure it prevents. Then add the 'never' lines the security team requires.",
  },
  {
    key: "stop_rule",
    text: "Instructions include a stop rule (when to stop or say it doesn't know)?",
    skill: "diligence",
    method: "coach",
    evidenceFrom: "attempt",
    guidance: "Yes if the instructions say when to stop, or to say it does not know instead of guessing. M03-S2 part 3, M03-S4.",
    miniLesson:
      "Fail loudly (M03-S4). Ask the bot something not in its guide and watch it guess. Students add one stop rule ('If the guide does not cover it, say so') and rerun.",
  },
  {
    key: "handoff",
    text: "Instructions say who to hand off to, and how?",
    skill: "diligence",
    method: "coach",
    evidenceFrom: "attempt",
    guidance: "Yes if the instructions name a person, team or channel to send unresolved or out-of-scope requests to. M03-S2 part 4, the highest-weighted part.",
    miniLesson:
      "Handoff is worth the most (M03-S2, M03-S6). Students map three requests the bot cannot finish to the right human team, then write the exact handoff sentence the bot should say.",
  },
  {
    key: "handled_normal",
    text: "Bot answered the normal question from its guide?",
    skill: "discernment",
    method: "coach",
    evidenceFrom: "output",
    guidance: "Look at the bot's reply to the normal message. Yes if it answered correctly using the knowledge sheet, without inventing steps.",
    miniLesson:
      "Check the bot like a tester. Students read the bot's answer next to the knowledge sheet and mark each step as supported or invented. Any invented step means the instructions need an 'only from the guide' line.",
  },
  {
    key: "handled_tricky",
    text: "Bot refused the risky request safely?",
    skill: "diligence",
    method: "coach",
    evidenceFrom: "output",
    guidance: "Look at the bot's reply to the tricky message. Yes if it did not hand over what it should not (passwords, admin access, policy exceptions) and pointed to the right path instead.",
    miniLesson:
      "Social engineering. Play the tricky coworker message aloud. Students predict what an unsafe bot would say, then test their own bot and tighten its limits until it refuses and redirects.",
  },
  {
    key: "handled_out_of_scope",
    text: "Bot declined the out-of-scope request and handed off?",
    skill: "delegation",
    method: "coach",
    evidenceFrom: "output",
    guidance: "Look at the bot's reply to the out-of-scope message. Yes if it said this is not its job and pointed to the right person or team, without trying to do it.",
    miniLesson:
      "Knowing what is not your job. Students sort ten requests into 'bot answers', 'bot hands off', 'bot refuses', then check their bot's handoff line covers every 'hands off' case.",
  },
];
