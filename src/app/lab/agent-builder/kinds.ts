import type { CoworkerMessage } from "@/lib/curriculum/types";

/** Labels and tag styles for the three scripted coworker messages. Shared by the page and the form. */
export const KIND_LABELS: Record<CoworkerMessage["kind"], string> = {
  normal: "Normal",
  tricky: "Tricky",
  out_of_scope: "Out of scope",
};

export const KIND_TAG: Record<CoworkerMessage["kind"], string> = {
  normal: "tag-info",
  tricky: "tag-warn",
  out_of_scope: "tag-sim",
};
