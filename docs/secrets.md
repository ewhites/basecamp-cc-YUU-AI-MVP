# Secrets and settings (names only, never values)

| Name | What it's for | Where it lives |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Claude API (coach, runs, Arena, the sandbox's live build) | Vercel project `yuu-ai-lab` (Production only; Preview has none, so preview coaching saves attempts as pending); `.env.local` for local dev (rejected with a 401 on 2026-11-19: needs a fresh key) |
| `LAB_SIGNING_SECRET` | Signs session cookies, Arena results, portfolio links (`openssl rand -hex 32`) | Vercel (Production, sensitive). Preview has its own value, generated 2026-11-19 |
| `LAB_DEMO_LOGIN` | `1` turns on the simulated sign-in | Vercel (Production; Preview added 2026-11-19) |
| `LAB_MONTHLY_SPEND_CAP_USD` | Lab-wide monthly Claude spend cap (`5`) | Vercel |
| `LAB_DAILY_TOKEN_BUDGET_PER_STUDENT` | Daily token budget per student (`60000`) | Vercel |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis store `yuu-ai-lab-demo` (free plan, auto-upgrade off, iad1) that shares demo data between server instances | Added by the Vercel Marketplace integration (Production). Also created, unused: `KV_URL`, `REDIS_URL`, `KV_REST_API_READ_ONLY_TOKEN` |

The Vercel project has no connected Git repository (2026-11-19): pushing a branch does not deploy. Preview deploys are made with `vercel deploy` from this folder.
