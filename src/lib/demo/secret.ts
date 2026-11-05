import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signing keys for demo session cookies, Arena results and portfolio links.
 * Production fails closed: LAB_SIGNING_SECRET must be set (32+ characters). Local dev uses a
 * fixed key so the demo runs with no setup. Each purpose gets its own derived key.
 */
export type Purpose = "session" | "arena" | "portfolio";

function rootSecret(): string {
  const s = process.env.LAB_SIGNING_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("LAB_SIGNING_SECRET must be set to a random value of at least 32 characters in production.");
  }
  return "yuu-ai-lab-local-dev-only-signing-secret";
}

export function signingKey(purpose: Purpose): Buffer {
  return createHmac("sha256", rootSecret()).update(`yuu-ai-lab:${purpose}`).digest();
}

export function sign(value: string, purpose: Purpose = "session"): string {
  return createHmac("sha256", signingKey(purpose)).update(value).digest("base64url");
}

export function verify(value: string, sig: string, purpose: Purpose = "session"): boolean {
  const a = Buffer.from(sign(value, purpose));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The persona sign-in exists only for demos: local dev, or production with LAB_DEMO_LOGIN=1. */
export function demoLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.LAB_DEMO_LOGIN === "1";
}
