import type { Prisma } from "@/generated/prisma/client";
import type { Comment, ViewerOpts } from "@/lib/types";

/**
 * Who may see what, as Prisma `where` fragments.
 *
 * Three rules, from the debrief via ARCHITECTURE Appendix A:
 *
 *   - deleted items are gone for everyone
 *   - dead items are hidden from listings unless the viewer opted in, but stay at their permalink
 *   - a shadow-banned author's content is visible only to that author and to moderators
 *
 * Written once, here, and spread into every query rather than re-expressed per call site. A rule
 * that is stated in two places is a rule that will eventually be enforced in one.
 *
 * These were predicates over fixture rows in phase 1. Moving them into the `where` is the point of
 * the exercise: filtering in Postgres means a listing reads 30 rows instead of reading every row
 * and discarding most of them — and it is the same decision for correctness, because a filter the
 * database applies cannot be forgotten by a caller that assembles its own query.
 */

/** A shadow-banned author is visible to themselves and to moderators, and to nobody else. */
function authorVisible(opts: ViewerOpts): Prisma.UserWhereInput | undefined {
  if (opts.isModerator) return undefined;
  if (opts.userId === null) return { isShadowBanned: false };
  // Your own content stays visible to you, which is what makes a shadow ban a shadow ban.
  return { OR: [{ isShadowBanned: false }, { username: opts.userId }] };
}

/** Dead items are a listing-level hide, not a deletion — `reachableAtPermalink` omits this. */
function deadVisible(opts: ViewerOpts): Prisma.PostWhereInput | null {
  return opts.showDead || opts.isModerator ? null : { isDead: false };
}

export function visiblePostWhere(opts: ViewerOpts): Prisma.PostWhereInput {
  const author = authorVisible(opts);
  const dead = deadVisible(opts);
  return {
    isDeleted: false,
    ...(dead ?? {}),
    ...(author ? { author } : {}),
  };
}

/**
 * A dead post still renders at its own permalink; only listings hide it. Keeping this separate from
 * `visiblePostWhere` is what stops a permalink from 404ing the moment an item is flagged — every
 * link ever shared would break.
 */
export function reachableAtPermalinkWhere(opts: ViewerOpts): Prisma.PostWhereInput {
  const author = authorVisible(opts);
  return {
    isDeleted: false,
    ...(author ? { author } : {}),
  };
}

export function visibleCommentWhere(opts: ViewerOpts): Prisma.CommentWhereInput {
  const author = authorVisible(opts);

  // A comment can be shadowed on its own row as well as through its author's ban.
  const ownShadow: Prisma.CommentWhereInput | null = opts.isModerator
    ? null
    : opts.userId === null
      ? { isShadow: false }
      : { OR: [{ isShadow: false }, { author: { username: opts.userId } }] };

  const dead: Prisma.CommentWhereInput | null =
    opts.showDead || opts.isModerator ? null : { isDead: false };

  // AND rather than spread: `ownShadow` and `author` can both contribute an `OR`, and spreading
  // would have the second silently replace the first.
  const clauses = [ownShadow, dead, author ? { author } : null].filter(
    (c): c is Prisma.CommentWhereInput => c !== null,
  );

  return clauses.length > 0 ? { AND: clauses } : {};
}

/**
 * Collapse the two ways a comment can be shadowed — its own flag, or its author's ban — into the
 * one field the thread renders, so no component has to ask the user service a question about a
 * comment, and a moderator is never shown hidden content unlabelled.
 *
 * Takes the ban as a flag rather than looking it up: the caller has already joined the author.
 */
export function collapseShadow(comment: Comment, authorIsShadowBanned: boolean): Comment {
  if (comment.isShadow || !authorIsShadowBanned) return comment;
  return { ...comment, isShadow: true };
}
