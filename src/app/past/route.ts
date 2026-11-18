import { redirect } from "next/navigation";
import { formatIsoDate } from "@/lib/format";

/**
 * "Past" in the nav needs a date, and reading the clock in the header would make the whole header
 * depend on the request for one link. It is a redirect, not a page, so it is a route handler
 * rather than a component — there is no UI to render.
 */
export async function GET() {
  redirect(`/front/${formatIsoDate(new Date())}`);
}
