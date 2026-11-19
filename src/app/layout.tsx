import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "@/design/tokens.css";
import "@/design/base.css";
import "@/design/components.css";
import "@/design/areas/entry.css";
import "@/design/areas/learn.css";
import "@/design/areas/staff.css";
import "@/design/areas/info.css";
import "@/design/areas/admin.css";
import "@/design/areas/sandbox.css";

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
