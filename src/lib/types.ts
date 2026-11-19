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
  /**
   * A cache that M11's nightly job recomputes from `Vote`.
   *
   * No post/comment split: Appendix D stores one `karma` column, and the split is only derivable
   * once `Vote` has rows, because `itemType` is what distinguishes the two. The profile showed a
   * split while the fixtures happened to carry one; over Postgres that became "N from posts · 0
   * from comments" on every profile — a fabricated number presented as a fact. It comes back in
   * M11, from votes, or not at all.
   */
  karma: number;
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
/**
 * A post as the ranked listing needs it.
 *
 * `ageHours` and `score` were here for Figure 1 and `/rank-debug`, which printed the arithmetic
 * behind the order. Both are gone, and nothing read either field afterwards — the listing shows
 * points and a relative age it formats itself. The ordering is still the stored `RankedPost.score`;
 * it is simply no longer carried up to be displayed.
 */
export type ScoredPost = {
  post: Post;
  points: number;
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
  /**
   * Shadow-banned: visible only to its author and to moderators. On the contract rather than on the
   * fixture row because a moderator reading a thread has to be *told* why they can see it — the
   * alternative is a moderator mistaking hidden content for public content.
   */
  isShadow: boolean;
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

