import { redirect } from "next/navigation";
import { formatIsoDate } from "@/lib/format";

/**
 * "Past" in the nav needs a date, and reading the clock in the header would make the whole header
 * unprerenderable for one link. This is a redirect, not a page — a route handler rather than a
 * component, so there is nothing to prerender.
 */
export async function GET() {
  redirect(`/front/${formatIsoDate(new Date())}`);
}
