import type { Metadata } from "next";
import { preload } from "react-dom";
import { Gallery } from "./Gallery";
import "./gallery.css";

export const metadata: Metadata = {
  title: "Design gallery · AI Lab",
  robots: { index: false, follow: false },
};

/** Review page for the Phase 1 components. Not linked from the app. */
export default function DesignPage() {
  preload("/materials/ground.webp", { as: "image", fetchPriority: "high" });
  return <Gallery />;
}
