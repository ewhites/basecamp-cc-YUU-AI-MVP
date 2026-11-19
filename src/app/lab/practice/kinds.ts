import type { CoworkerMessage } from "@/lib/curriculum/types";

/** Labels for the three scripted coworker messages, shown as plain text. Shared by the page and the form. */
export const KIND_LABELS: Record<CoworkerMessage["kind"], string> = {
  normal: "Normal",
  tricky: "Tricky",
  out_of_scope: "Out of scope",
};
