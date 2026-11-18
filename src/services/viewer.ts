import { cache } from "react";
import { findUser } from "@/fixtures";
import type { User, ViewerOpts } from "@/lib/types";

/**
 * Who is signed in. The second seam after the service layer: phase 1 returns a fixture user so the
 * own-item marker, "by you" bylines and the karma in the title block all have something real to
 * render. M10 replaces the body with Clerk's session and nothing above this changes.
 *
 * Returning null here is how you preview the signed-out reading paths.
 */
const FIXTURE_VIEWER = "mlin";

export type Viewer = { user: User; opts: ViewerOpts };

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = findUser(FIXTURE_VIEWER);
  if (!user) return null;
  return {
    user,
    opts: { userId: user.username, isModerator: user.isModerator, showDead: user.showDead },
  };
});

/** The viewer's options, or the signed-out defaults — what every service read wants. */
export const getViewerOpts = cache(async (): Promise<ViewerOpts> => {
  const viewer = await getViewer();
  return viewer?.opts ?? { userId: null, isModerator: false, showDead: false };
});
