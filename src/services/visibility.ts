import { findUser, type FixtureComment } from "@/fixtures";
import type { Post, ViewerOpts } from "@/lib/types";

/**
 * Who may see what. Written here, in phase 1, against fixtures — so phase 2 inherits these rules
 * rather than reinventing them against SQL. Three rules, from PROJECT debrief §6 via
 * ARCHITECTURE Appendix A:
 *
 *   - deleted items are gone for everyone
 *   - dead items are hidden from listings unless the viewer opted in, but stay at their permalink
 *   - a shadow-banned author's content is visible only to that author and to moderators
 */

function shadowHidden(author: string, opts: ViewerOpts): boolean {
  const user = findUser(author);
  if (!user?.isShadowBanned) return false;
  return opts.userId !== author && !opts.isModerator;
}

export function visiblePost(post: Post, opts: ViewerOpts): boolean {
  if (post.isDeleted) return false;
  if (post.isDead && !opts.showDead && !opts.isModerator) return false;
  return !shadowHidden(post.author, opts);
}

/** A dead post still renders at its own permalink; only listings hide it. */
export function reachableAtPermalink(post: Post, opts: ViewerOpts): boolean {
  if (post.isDeleted) return false;
  return !shadowHidden(post.author, opts);
}

export function visibleComment(comment: FixtureComment, opts: ViewerOpts): boolean {
  if (comment.isShadow && opts.userId !== comment.author && !opts.isModerator) return false;
  if (comment.isDead && !opts.showDead && !opts.isModerator) return false;
  return !shadowHidden(comment.author, opts);
}
