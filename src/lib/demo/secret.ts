import { createHmac, timingSafeEqual } from "node:crypto";

/** Signing secret for demo session cookies, arena outputs and portfolio links. Set LAB_SIGNING_SECRET in production. */
export function signingSecret(): string {
  return process.env.LAB_SIGNING_SECRET ?? "yuu-ai-lab-local-demo-secret";
}

export function sign(value: string): string {
  return createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

export function verify(value: string, sig: string): boolean {
  const a = Buffer.from(sign(value));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
