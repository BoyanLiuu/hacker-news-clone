/**
 * What the service layer returns. These shapes are the contract that survives phase 2:
 * fixtures satisfy them now, Prisma satisfies them later, and nothing above the services changes.
 * See ARCHITECTURE Appendix C.
 */

export type ItemType = "post" | "comment";

/** Who is looking. Present from the first milestone so visibility rules are written once. */
export type ViewerOpts = {
  /** The viewer's username, or null when signed out. */
  userId: string | null;
  isModerator: boolean;
  showDead: boolean;
};

/** Frozen: a module-level object shared by every request must not be mutable. */
export const ANONYMOUS: ViewerOpts = Object.freeze({
  userId: null,
  isModerator: false,
  showDead: false,
});

export type User = {
  username: string;
  createdAt: Date;
  /** post karma + comment karma. A cache in phase 2; derived here. */
  karma: number;
  postKarma: number;
  commentKarma: number;
  about: string;
  isModerator: boolean;
  isShadowBanned: boolean;
  showDead: boolean;
};

export type Post = {
  id: number;
  author: string;
  title: string;
  /** url XOR text */
  url: string | null;
  text: string | null;
  /** registrable domain, derived from the url */
  domain: string | null;
  scoreRaw: number;
  commentCount: number;
  createdAt: Date;
  editedAt: Date | null;
  isDead: boolean;
  isDeleted: boolean;
  flags: number;
};

/** A post with its computed rank score — what the front page and Figure 1 both read. */
export type ScoredPost = {
  post: Post;
  /** points at the time being scored; differs from post.scoreRaw only for a past date */
  points: number;
  ageHours: number;
  score: number;
};

export type Comment = {
  id: number;
  postId: number;
  parentId: number | null;
  author: string;
  text: string;
  /** zero-padded ancestry, e.g. "0000000012.0000000019" — lexicographic sort is display order */
  path: string;
  depth: number;
  scoreRaw: number;
  createdAt: Date;
  isDead: boolean;
  isDeleted: boolean;
};

/** A comment with its children attached, as `tree.ts` assembles it. */
export type CommentNode = Comment & { children: CommentNode[] };

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
};

/** Thrown by every mutation during phase 1: forms render and validate, they just cannot persist. */
export class NotImplementedInStaticPhase extends Error {
  constructor(operation: string) {
    super(`${operation} needs the database, which arrives in M7. Phase 1 is read-only.`);
    this.name = "NotImplementedInStaticPhase";
  }
}
