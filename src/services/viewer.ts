import { cookies } from "next/headers";
import { cache } from "react";
import { findUser } from "@/fixtures";
import { CFG, DAY } from "@/lib/config";
import type { User, ViewerOpts } from "@/lib/types";

/**
 * Who is signed in. The second seam after the service layer: phase 1 resolves a fixture user so the
 * own-item marker, "by you" bylines and the karma in the title block all have something real to
 * render. M10 replaces the body of `getViewer` with Clerk's session and nothing above this changes.
 */
const DEFAULT_VIEWER = "mlin";

/**
 * The cookie `/preview` sets, so the signed-out, new-account and moderator surfaces are reachable
 * without editing code. Phase 1 only: M10 deletes this, the route, and the switcher on `/settings`.
 */
export const PREVIEW_COOKIE = "tally-preview-as";
export const SIGNED_OUT = "signed-out";

/**
 * The viewer plus what they are allowed to do.
 *
 * The permissions are computed here rather than in components for two reasons: they are the
 * debrief's rules, not rendering details, and they depend on the clock — which makes them impure
 * in a render and inconsistent across one page if each component asks separately. Computed once
 * per request, behind `cache()`.
 */
export type Viewer = {
  user: User;
  opts: ViewerOpts;
  accountAgeDays: number;
  /** New accounts cannot flag or downvote — debrief §6. */
  isNewAccount: boolean;
  canFlag: boolean;
  canDownvote: boolean;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const requested = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (requested === SIGNED_OUT) return null;

  // An unknown name falls back rather than signing you out, so a stale cookie cannot strand you.
  const user = findUser(requested ?? DEFAULT_VIEWER) ?? findUser(DEFAULT_VIEWER);
  if (!user) return null;

  const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / DAY);
  const established = accountAgeDays >= CFG.flagMinDays && user.karma >= CFG.flagMinKarma;

  return {
    user,
    opts: { userId: user.username, isModerator: user.isModerator, showDead: user.showDead },
    accountAgeDays,
    isNewAccount: !established,
    canFlag: established,
    canDownvote: user.karma >= CFG.downvoteKarma,
  };
});

/** The viewer's options, or the signed-out defaults — what every service read wants. */
export const getViewerOpts = cache(async (): Promise<ViewerOpts> => {
  const viewer = await getViewer();
  return viewer?.opts ?? { userId: null, isModerator: false, showDead: false };
});
