import type { Comment, Post, User } from "@/lib/types";
import { collapseShadow } from "./visibility";

/**
 * Prisma rows to the models in `lib/types.ts`.
 *
 * One mapping, in one place, because this is the seam ARCHITECTURE Appendix C is about: above it
 * nothing knows the database exists. The models key authorship by `username`, not `authorId` —
 * which is deliberate, since a byline, a profile link and an ownership check all want the name and
 * none of them want an integer. Every read therefore joins the author.
 *
 * The `AUTHOR` select below is what that join costs: three columns, not a whole user row.
 */
export const AUTHOR = { select: { username: true, isShadowBanned: true } } as const;

/**
 * Load relations with a JOIN, not a query per level.
 *
 * Prisma's default issues one statement per relation level, sequentially — three for
 * `RankedPost → Post → User`, each costing a ~105 ms round trip to do 0.26 ms of work. Measured at
 * 320 ms against 114 ms; see the README. Set once here rather than per call site, and it needs the
 * `relationJoins` preview feature in the generator block.
 */
export const JOIN = { relationLoadStrategy: "join" } as const;

type WithAuthor<T> = T & { author: { username: string; isShadowBanned: boolean } };

type PostRow = {
  id: number;
  title: string;
  url: string | null;
  text: string | null;
  domain: string | null;
  scoreRaw: number;
  commentCount: number;
  createdAt: Date;
  editedAt: Date | null;
  isDead: boolean;
  isDeleted: boolean;
};

export function toPost(row: WithAuthor<PostRow>): Post {
  return {
    id: row.id,
    author: row.author.username,
    title: row.title,
    url: row.url,
    text: row.text,
    domain: row.domain,
    scoreRaw: row.scoreRaw,
    commentCount: row.commentCount,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    isDead: row.isDead,
    isDeleted: row.isDeleted,
    // `flags` is not stored on the row: Flag is a table, and a count would be a second query on
    // every listing read. Nothing outside the moderation queue uses it, and that queue counts
    // flags itself — see `getFlagged`.
    flags: 0,
  };
}

type CommentRow = {
  id: number;
  postId: number;
  parentId: number | null;
  text: string;
  path: string;
  depth: number;
  scoreRaw: number;
  isDead: boolean;
  isDeleted: boolean;
  isShadow: boolean;
  createdAt: Date;
};

export function toComment(row: WithAuthor<CommentRow>): Comment {
  const comment: Comment = {
    id: row.id,
    postId: row.postId,
    parentId: row.parentId,
    author: row.author.username,
    text: row.text,
    path: row.path,
    depth: row.depth,
    scoreRaw: row.scoreRaw,
    isDead: row.isDead,
    isDeleted: row.isDeleted,
    isShadow: row.isShadow,
    createdAt: row.createdAt,
  };
  // Done here because the author's ban is in hand exactly now, from the join above.
  return collapseShadow(comment, row.author.isShadowBanned);
}

type UserRow = {
  username: string;
  about: string;
  karma: number;
  isModerator: boolean;
  isShadowBanned: boolean;
  showDead: boolean;
  createdAt: Date;
};

export function toUser(row: UserRow): User {
  return {
    username: row.username,
    createdAt: row.createdAt,
    karma: row.karma,
    about: row.about,
    isModerator: row.isModerator,
    isShadowBanned: row.isShadowBanned,
    showDead: row.showDead,
  };
}
