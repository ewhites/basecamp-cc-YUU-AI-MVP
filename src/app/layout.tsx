import type { Metadata } from "next";
import "./globals.css";
import "./styles/learn.css";
import "./styles/checks.css";
import "./styles/instructor.css";

export const metadata: Metadata = {
  title: "AI Lab · AI Foundations",
  description: "Year Up United AI Lab prototype (sample data)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
