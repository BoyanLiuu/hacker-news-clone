import { redirect } from "next/navigation";
import { getAuthState, getViewer, type Viewer } from "./viewer";

/**
 * The gate for a page that needs a usable account.
 *
 * Two redirects rather than one, because there are two ways to lack an account: no session at all,
 * and a session whose username has not been claimed. Sending the second case to `/sign-in` would
 * loop — they are already signed in. Both reads come from one cached query (`loadSession`).
 *
 * Called in the page body rather than in `proxy.ts`: `createRouteMatcher` is deprecated in
 * `@clerk/nextjs` 7, and current guidance is a bare `clerkMiddleware()` with the check next to the
 * thing it protects. That also keeps the username rule out of the middleware, where it would need a
 * database read on every request.
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
