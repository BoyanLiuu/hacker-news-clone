import { redirect } from "next/navigation";
import { getAuthState, getViewer, type Viewer } from "./viewer";

/**
 * The gate for a page that needs a usable account.
 *
 * Two redirects, because there are two ways to lack an account: no session, and a session whose
 * username is unclaimed. Sending the second to `/sign-in` would loop. Both reads come from one
 * cached query (`loadSession`).
 *
 * Called in the page body, not middleware: `createRouteMatcher` is deprecated in `@clerk/nextjs` 7,
 * and the username rule would need a database read on every request at the edge.
 */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer) return viewer;

  redirect((await getAuthState()) === "onboarding" ? "/welcome" : "/sign-in");
}

/** Moderator-only pages. A non-moderator is told plainly rather than redirected into a loop. */
export async function requireModerator(): Promise<Viewer | null> {
  const viewer = await requireViewer();
  return viewer.user.isModerator ? viewer : null;
}
