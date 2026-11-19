import { auth } from "@clerk/nextjs/server";
import { cache } from "react";
import { CFG, DAY } from "@/lib/config";
import { db } from "@/lib/db";
import type { User, ViewerOpts } from "@/lib/types";
import { toUser } from "./map";

/** Set by `/preview?slow=on`. Slows every stepped transition 16x so it can be reviewed. */
export const SLOW_COOKIE = "tally-slow-motion";

/**
 * The viewer plus what they are allowed to do.
 *
 * Permissions live here, not in components: they are domain rules that depend on the clock, which
 * is impure in a render and inconsistent across one page if each component asks separately.
 */
export type Viewer = {
  user: User;
  /**
   * The database key, beside `user` rather than inside it. `Vote` and `Flag` are keyed on the
   * numeric id, but the service contract names people by username everywhere else (Appendix C), and
   * putting an integer id on `User` would invite it into URLs and bylines where it does not belong.
   */
  userId: number;
  opts: ViewerOpts;
  accountAgeDays: number;
  /** New accounts cannot flag or downvote — debrief §6. */
  isNewAccount: boolean;
  canFlag: boolean;
  canDownvote: boolean;
};

type UserRow = {
  id: number;
  username: string;
  about: string;
  karma: number;
  isModerator: boolean;
  isShadowBanned: boolean;
  showDead: boolean;
  createdAt: Date;
};

const SELECT = {
  id: true,
  username: true,
  about: true,
  karma: true,
  isModerator: true,
  isShadowBanned: true,
  showDead: true,
  createdAt: true,
} as const;

/**
 * Three states, and the middle one is why this exists apart from `getViewer`.
 *
 * Clerk owns identity; this app owns the username, claimed at `/welcome`, which is the URL for every
 * profile and byline. So a session can be valid while the account is not yet usable here.
 * `getViewer` collapses that case to `null` — right for rendering, since there is no name to show —
 * and pages that must send the person somewhere ask this instead.
 */
export type AuthState = "anonymous" | "onboarding" | "active";

/**
 * One read behind both `getAuthState` and `getViewer`.
 *
 * They answer different questions about the same row, and asking separately cost two round trips to
 * Supabase at ~105 ms each — `requireViewer` paid both, sequentially, on every protected page. The
 * query itself is a primary-key lookup; the trip is the whole cost.
 */
const loadSession = cache(async (): Promise<{ signedIn: boolean; row: UserRow | null }> => {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { signedIn: false, row: null };

  return { signedIn: true, row: await db.user.findUnique({ where: { clerkId }, select: SELECT }) };
});

export const getAuthState = cache(async (): Promise<AuthState> => {
  const { signedIn, row } = await loadSession();
  if (!signedIn) return "anonymous";
  return row ? "active" : "onboarding";
});

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const { row } = await loadSession();
  // Signed out, or authenticated but unnamed: either way there is no byline to render.
  if (!row) return null;

  const user = toUser(row);
  const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / DAY);
  const established = accountAgeDays >= CFG.flagMinDays && user.karma >= CFG.flagMinKarma;

  return {
    user,
    userId: row.id,
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
