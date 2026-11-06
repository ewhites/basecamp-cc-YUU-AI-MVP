import { redirectToPractice } from "../practice/redirect";

/** Old route: the studio is now a practice step in the course player. Keeps ?ex= links working. */
export default async function ModelArena({ searchParams }: { searchParams: Promise<{ ex?: string | string[] }> }) {
  return redirectToPractice(searchParams, "arena");
}
