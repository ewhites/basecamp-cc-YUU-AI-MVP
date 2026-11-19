import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";

/**
 * The AI Lab is no longer opened from Brightspace (Logan, 2026-11-19). /home stays as a route because sign-in
 * and saved links land here: it sends each viewer to their start page.
 */
export default async function Home() {
  const v = await getViewer();
  if (!v) redirect("/");
  redirect(v.role === "student" ? "/lab" : v.role === "admin" ? "/lab/admin" : "/lab/instructor?section=B");
}
