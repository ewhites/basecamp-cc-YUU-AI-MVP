# Secrets and settings (names only, never values)

| Name | What it's for | Where it lives |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Claude API (coach, runs, Arena) | Vercel project `yuu-ai-lab` (Production); `.env.local` for local dev |
| `LAB_SIGNING_SECRET` | Signs session cookies, Arena results, portfolio links (`openssl rand -hex 32`) | Vercel (Production, sensitive) |
| `LAB_DEMO_LOGIN` | `1` turns on the simulated sign-in | Vercel |
| `LAB_MONTHLY_SPEND_CAP_USD` | Lab-wide monthly Claude spend cap (`5`) | Vercel |
| `LAB_DAILY_TOKEN_BUDGET_PER_STUDENT` | Daily token budget per student (`60000`) | Vercel |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis store `yuu-ai-lab-demo` (free plan, auto-upgrade off, iad1) that shares demo data between server instances | Added by the Vercel Marketplace integration (Production). Also created, unused: `KV_URL`, `REDIS_URL`, `KV_REST_API_READ_ONLY_TOKEN` |
