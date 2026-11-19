/**
 * Signing out, server-side.
 */
"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Clerk's cookie names carry an instance suffix (`__session_Yg3t5NpL`), so they are matched by
 * prefix rather than listed. `clerk_active_context` has no suffix and is matched whole.
 *
 * `__clerk_db_jwt` is included but observed to come back: on a development instance it is a handle
 * identifying the *browser* to Clerk, not a session, and Clerk re-sets it. Measured after a logout:
 * every `__session*` cookie gone, `__clerk_db_jwt*` still present, and the viewer signed out with
 * `/submit` redirecting. The session cookie is the one that authenticates, so that is the one that
 * has to go.
 */
const CLERK_COOKIE_PREFIXES = ["__session", "__clerk_db_jwt", "clerk_active_context"];

/**
 * End the session and go home.
 *
 * A Server Action rather than Clerk's `<SignOutButton>`, which is a client component and would pull
 * the React SDK onto every page through the header — see `(auth)/layout.tsx`.
 *
 * Both halves are required and the first version shipped only one. Revoking kills the session for
 * anyone holding the token; deleting the cookies is what signs *this* browser out, because the
 * session JWT is self-contained and stays valid for its full 60 seconds. A revoke alone left the
 * header showing the user and `/submit` reachable.
 */
export async function signOut(): Promise<void> {
  const { sessionId } = await auth();

  if (sessionId) {
    const client = await clerkClient();
    // A revoke can fail on an already-expired session, and the cookies must go regardless —
    // otherwise a transient API error leaves someone signed in at a terminal they walked away from.
    await client.sessions.revokeSession(sessionId).catch((error: unknown) => {
      console.error("revokeSession failed; clearing cookies anyway", { sessionId, error });
    });
  }

  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if (CLERK_COOKIE_PREFIXES.some((prefix) => cookie.name.startsWith(prefix))) {
      jar.delete(cookie.name);
    }
  }

  // Every page shows the viewer in its header, so all of them are now wrong.
  revalidatePath("/", "layout");
  redirect("/");
}
