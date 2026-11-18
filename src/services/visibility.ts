import { findUser } from "@/fixtures";
import type { Comment, Post, ViewerOpts } from "@/lib/types";

/**
 * Who may see what. Written here, in phase 1, against fixtures — so phase 2 inherits these rules
 * rather than reinventing them against SQL. Three rules, from PROJECT debrief §6 via
 * ARCHITECTURE Appendix A:
 *
 *   - deleted items are gone for everyone
 *   - dead items are hidden from listings unless the viewer opted in, but stay at their permalink
 *   - a shadow-banned author's content is visible only to that author and to moderators
 */

/** A ban applies to everything the author writes, including rows not individually flagged. */
export function isShadowBannedAuthor(author: string): boolean {
  return findUser(author)?.isShadowBanned === true;
}

function shadowHidden(author: string, opts: ViewerOpts): boolean {
  if (!isShadowBannedAuthor(author)) return false;
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

/**
 * Collapse the two ways a comment can be shadowed — its own flag, or its author's ban — into the
 * one field the thread renders. Applied where rows are read, so no component has to ask the user
 * service a question about a comment, and a moderator is never shown hidden content unlabelled.
 */
export function collapseShadow(comment: Comment): Comment {
  if (comment.isShadow || !isShadowBannedAuthor(comment.author)) return comment;
  return { ...comment, isShadow: true };
}

export function visibleComment(comment: Comment, opts: ViewerOpts): boolean {
  if (comment.isShadow && opts.userId !== comment.author && !opts.isModerator) return false;
  if (comment.isDead && !opts.showDead && !opts.isModerator) return false;
  return !shadowHidden(comment.author, opts);
}
