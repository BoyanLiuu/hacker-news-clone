import { HOUR, MINUTE } from "@/lib/config";
import { registrableDomain } from "@/lib/domain";
import type { Comment, Post, User } from "@/lib/types";
import { RAW_COMMENTS } from "./comments";
import { RAW_POSTS } from "./posts";
import { RAW_USERS } from "./users";

/**
 * Maps the generated raw rows into the model shapes the services return.
 *
 * Read-only by design: no module-level mutation, no store that pretends to persist. Phase 1 writes
 * nothing, so there is no fake persistence to delete in phase 2 — ARCHITECTURE Appendix C.
 *
 * Timestamps are computed once at module load from relative ages, so the ranking and the age column
 * stay alive while you work rather than freezing at a hard-coded date.
 */
const LOADED_AT = Date.now();

export const users: readonly User[] = RAW_USERS.map((u) => ({
  username: u.username,
  createdAt: new Date(u.created),
  karma: u.postKarma + u.commentKarma,
  postKarma: u.postKarma,
  commentKarma: u.commentKarma,
  about: u.about,
  isModerator: u.isModerator,
  isShadowBanned: u.isShadowBanned,
  showDead: u.showDead,
}));

const userByName = new Map(users.map((u) => [u.username, u]));

/** Every name that appears as an author, so an unknown name is one Set lookup, not two scans. */
const authorNames = new Set<string>([
  ...RAW_POSTS.map((p) => p.author),
  ...RAW_COMMENTS.map((c) => c.author),
]);

/** Derived profiles are pure functions of the name, so each is built at most once. */
const derivedUsers = new Map<string, User>();

/**
 * An author not in the authored 14 gets a stable derived profile, matching the prototype: the
 * fixtures name more people than they describe, and a missing author must not blank a byline.
 *
 * Called for every post and comment during visibility checks, so both the miss path and the build
 * are memoised — a linear scan here is a scan per row.
 */
export function findUser(username: string): User | null {
  const known = userByName.get(username);
  if (known) return known;

  const memoised = derivedUsers.get(username);
  if (memoised) return memoised;

  if (!authorNames.has(username)) return null;

  let h = 0;
  for (const ch of username) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const postKarma = 40 + (h % 900);
  const commentKarma = 60 + (h % 2400);
  const derived: User = {
    username,
    createdAt: new Date(`20${18 + (h % 7)}-0${1 + (h % 9)}-1${h % 9}`),
    karma: postKarma + commentKarma,
    postKarma,
    commentKarma,
    about: "",
    isModerator: false,
    isShadowBanned: false,
    showDead: false,
  };
  derivedUsers.set(username, derived);
  return derived;
}

const commentCounts = new Map<number, number>();
for (const c of RAW_COMMENTS) {
  if (!c.isDeleted) commentCounts.set(c.postId, (commentCounts.get(c.postId) ?? 0) + 1);
}

export const posts: readonly Post[] = RAW_POSTS.map((p) => ({
  id: p.id,
  author: p.author,
  title: p.title,
  url: p.url,
  text: p.text,
  domain: registrableDomain(p.url),
  scoreRaw: p.points,
  commentCount: commentCounts.get(p.id) ?? 0,
  createdAt: new Date(LOADED_AT - p.ageHours * HOUR),
  editedAt: null,
  isDead: p.isDead,
  isDeleted: false,
  flags: p.flags,
}));

export const postById = new Map(posts.map((p) => [p.id, p]));

/** Shadow-banned authorship lives on the user, so the comment row carries it for the filter. */
export type FixtureComment = Comment & { isShadow: boolean };

export const comments: readonly FixtureComment[] = RAW_COMMENTS.map((c) => ({
  id: c.id,
  postId: c.postId,
  parentId: c.parentId,
  author: c.author,
  text: c.text,
  path: c.path,
  depth: c.depth,
  scoreRaw: c.score,
  createdAt: new Date(LOADED_AT - c.ageMinutes * MINUTE),
  isDead: c.isDead,
  isDeleted: c.isDeleted,
  isShadow: c.isShadow,
}));

export const commentById = new Map(comments.map((c) => [c.id, c]));
