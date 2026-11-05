import { redirect } from "next/navigation";

/** The old portfolio page now lives at Your skills. */
export default function Portfolio() {
  redirect("/lab/skills");
}
