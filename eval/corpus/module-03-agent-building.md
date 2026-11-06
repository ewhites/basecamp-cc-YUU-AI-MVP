# Module 03 — Building an Agent

> SOURCE OF TRUTH. The module chatbot may only teach what is written here.
> Citation keys: M03-S1 …

## M03-S1 — What makes something an agent

In this course an agent is a system that does three things a plain prompt does not:

1. It **takes an action** in the world, not just produces text.
2. It **decides** which action to take.
3. It **loops** — it can act, look at the result, and act again.

If it does not loop, the module calls it a *workflow*, not an agent. Students are
expected to use that distinction precisely.

## M03-S2 — The four-part agent spec

Before building anything, students write a four-part spec:

1. **Job** — one sentence, one outcome.
2. **Tools** — the exact list of actions it may take.
3. **Stop rule** — what makes it finish, and the hard ceiling (e.g. "max 5 steps").
4. **Handoff** — what it does when it cannot finish, and who it hands to.

The Handoff is the part students most often skip and is worth the most on the rubric.

## M03-S3 — Smallest useful tool set

Give an agent the fewest tools that let it finish the job. Every extra tool is another
way for it to go wrong. The module's rule: **if you cannot name a failure the tool
prevents, remove the tool.**

## M03-S4 — Agents fail loudly, not silently

A correct agent that cannot finish must say so and hand off. An agent that invents a
result to appear successful has failed the assignment regardless of output quality.
This is the single most heavily weighted item on the Module 03 rubric.

## M03-S5 — The lab environment

Students build agents inside the provided course sandbox only. Agents built in the lab
may not send email, may not post to the internet, and may not touch any system outside
the sandbox. These limits are set by the Year Up United security team and students
cannot request exceptions.

## M03-S6 — The Module 03 rubric

| Criterion | Points |
|---|---|
| Four-part spec complete | 3 |
| Handoff defined and tested | 4 |
| Tool set justified (M03-S3 rule) | 2 |
| Agent fails loudly when blocked | 6 |
| Stays inside sandbox limits | 5 |

Total 20. Passing is 14. Failing the sandbox criterion fails the whole module
regardless of total.

## M03-S7 — The stop conditions still apply

M01-S6's three stop conditions are the course's transferable rule and apply here too.
