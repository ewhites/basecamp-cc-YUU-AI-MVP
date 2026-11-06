import { redirectToPractice } from "./redirect";

/** /lab/practice?ex=<id> (portfolio links) opens that practice step. */
export default async function PracticeIndex({ searchParams }: { searchParams: Promise<{ ex?: string | string[] }> }) {
  return redirectToPractice(searchParams);
}
