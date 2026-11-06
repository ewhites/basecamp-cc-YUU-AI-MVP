/** Prints only whether the expected env keys are set (never their values). */
try { process.loadEnvFile(".env.local"); } catch { /* none */ }
for (const k of ["ANTHROPIC_API_KEY", "VERCEL_OIDC_TOKEN"]) console.log(`${k}: ${process.env[k] ? "set" : "MISSING"}`);
