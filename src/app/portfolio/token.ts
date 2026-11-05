import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { signingSecret } from "@/lib/demo/secret";

/**
 * Share links for the skills portfolio. The token is an HMAC of the student's pseudonymous ID,
 * so the link reveals nothing about the student and cannot be guessed or forged without the secret.
 * Server only: the secret is LAB_PORTFOLIO_SECRET, or the local Supabase service key as a fallback.
 */
function secret(): string {
  return process.env.LAB_PORTFOLIO_SECRET ?? signingSecret();
}

export function portfolioToken(studentId: string): string {
  return createHmac("sha256", secret()).update(`portfolio:v1:${studentId}`).digest("base64url");
}

export function tokenMatches(studentId: string, token: string): boolean {
  const a = Buffer.from(portfolioToken(studentId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Shape check before any lookup: 32 bytes of SHA-256 in base64url is 43 characters. */
export function looksLikeToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
