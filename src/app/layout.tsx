import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import "./styles/learn.css";
import "./styles/checks.css";
import "./styles/instructor.css";
// The new design loads last, so its base rules win over the old globals.css until Phase 5 deletes them.
import "@/design/tokens.css";
import "@/design/base.css";
import "@/design/components.css";
import "@/design/areas/entry.css";
import "@/design/areas/learn.css";
import "@/design/areas/staff.css";

/* The Kaleos HQ fonts: Fraunces (soft axis and optical size) for headings, Hanken Grotesk for everything else. */
const fraunces = Fraunces({ subsets: ["latin"], axes: ["SOFT", "opsz"], variable: "--font-fraunces", display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });

export const metadata: Metadata = {
  title: "AI Lab · AI Foundations",
  description: "Year Up United AI Lab prototype (sample data)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`}>
      <body>{children}</body>
    </html>
  );
}
