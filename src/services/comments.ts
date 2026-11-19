import { cache } from "react";
import { unstable_cache } from "next/cache";
import { CFG } from "@/lib/config";
import { db } from "@/lib/db";
import { ancestorIds } from "@/lib/path";
import { buildTree } from "@/lib/tree";
import { ANONYMOUS, type Comment, type CommentNode, type ViewerOpts } from "@/lib/types";
import { AUTHOR, JOIN, toComment } from "./map";
import { visibleCommentWhere } from "./visibility";

const SELECT = {
  id: true,
  postId: true,
  parentId: true,
  text: true,
  path: true,
  depth: true,
  scoreRaw: true,
  isDead: true,
  isDeleted: true,
  isShadow: true,
  createdAt: true,
  author: AUTHOR,
} as const;

/**
 * A whole thread in one query: `where postId` and `order by path`.
 *
 * This is ARCHITECTURE §6.2's central claim, and it is why `path` exists. Lexicographic order over
 * zero-padded ancestry *is* depth-first display order, so Postgres returns the rows already
 * arranged and `buildTree` assembles them in a single pass — no recursive CTE, no N+1, no sort in
 * the application. Measured on the seeded 334-comment thread: 334 rows, zero parent-before-child
 * violations, served by the `[postId, path]` index.
 *
 * `getThread` builds on this rather than querying again, so a page wanting both the tree and the
 * row count pays once.
 */
async function threadRowsFromDb(postId: number, opts: ViewerOpts): Promise<Comment[]> {
  const rows = await db.comment.findMany({
    ...JOIN,
    where: { AND: [visibleCommentWhere(opts), { postId }] },
    orderBy: { path: "asc" },
    select: SELECT,
  });

  return rows.map(toComment);
}

/** The tag a thread's cached rows carry, so one new comment invalidates one thread. */
export function threadTag(postId: number): string {
  return `thread-${postId}`;
}

/**
 * A thread's rows, cached across requests for signed-out readers and tagged per post.
 *
 * Signed-out only, for the same reason as the front page: the query depends on `showDead`,
 * `isModerator` and `userId`, so a shared entry would serve one reader's visibility to another.
 *
 * Tagged rather than time-based, and tagged *per post*. A thread changes when someone comments on
 * it, not on a schedule, so there is no interval that is both fresh and useful. One shared tag
 * would mean a comment on any thread invalidated every thread, which is the blunt instrument this
 * replaces: `revalidatePath("/item")` is a no-op here, because every route in this app builds
 * dynamic and there is no route cache to invalidate. The tag is what actually makes a new comment
 * appear.
 *
 * The wrapper is built per postId because `unstable_cache` fixes its tags at definition time, and
 * the id has to be in the tag. The id is also in the key parts, or every thread would share one
 * entry.
 */
const cachedSignedOutRows = (postId: number) =>
  unstable_cache(() => threadRowsFromDb(postId, ANONYMOUS), ["thread-rows", String(postId)], {
    tags: [threadTag(postId)],
    // A backstop, not the mechanism. Tags are what make a new comment appear immediately; this is
    // what keeps a *missed* invalidation from being permanent — and with a tag-only cache it would
    // be. Anything that writes comments outside the actions has no tag to call: the HN importer,
    // the seed scripts, and a hand-run SQL fix all do. Five minutes stale is a nuisance; forever is
    // a bug report nobody can explain.
    revalidate: 300,
  })();

export const getThreadRows = cache(async (postId: number, opts: ViewerOpts): Promise<Comment[]> => {
  if (opts.userId !== null || opts.isModerator || opts.showDead) {
    return threadRowsFromDb(postId, opts);
  }

  // `unstable_cache` serialises through JSON, so Dates come back as strings — the same trap that
  // blanked the front page in M9. Revived here rather than at every call site.
  const rows = await cachedSignedOutRows(postId);
  return rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt) }));
});

export const getThread = cache(async (postId: number, opts: ViewerOpts): Promise<CommentNode[]> => {
  return buildTree(await getThreadRows(postId, opts));
});

/**
 * One page of a thread: `CFG.rootsPerPage` top-level comments, each with its whole subtree.
 *
 * Paginating the *roots* and not the rows is what keeps a thread readable. Slicing a flat row list
 * would cut subtrees in half and orphan replies whose parents fell on the previous page; a root
 * carries its own argument with it.
 *
 * The rows are still fetched in one query, because `buildTree` needs a parent before its children
 * and the cost measured on a 1 000-comment thread is 44.7 ms of query against a 263 ms render — the
 * document is what hurts, not the read. Fetching only the chosen roots' subtrees would mean either
 * a second query per root or a `path`-prefix `OR` across forty of them.
 */
export const getThreadPage = cache(
  async (
    postId: number,
    opts: ViewerOpts,
    page: number,
  ): Promise<{ roots: CommentNode[]; totalRoots: number; page: number; pages: number }> => {
    const all = await getThread(postId, opts);
    const pages = Math.max(1, Math.ceil(all.length / CFG.rootsPerPage));
    const current = Math.min(Math.max(1, page), pages);
    const start = (current - 1) * CFG.rootsPerPage;

    return {
      roots: all.slice(start, start + CFG.rootsPerPage),
      totalRoots: all.length,
      page: current,
      pages,
    };
  },
);

/**
 * A comment permalink: the comment, its subtree, and its ancestors for the breadcrumb.
 *
 * The subtree is a prefix match on `path` — the SQL form of "everything at or beneath this node" —
 * which is what the standalone `[path]` index is for. Three queries total, not one per level.
 */
export const getSubtree = cache(
  async (
    commentId: number,
    opts: ViewerOpts,
  ): Promise<{ ancestors: Comment[]; node: CommentNode } | null> => {
    const visible = visibleCommentWhere(opts);

    const root = await db.comment.findFirst({
      ...JOIN,
      where: { AND: [visible, { id: commentId }] },
      select: SELECT,
    });
    if (!root) return null;

    const ancestors = ancestorIds(root.path);
    const [subtreeRows, ancestorRows] = await Promise.all([
      db.comment.findMany({
        ...JOIN,
        where: { AND: [visible, { postId: root.postId, path: { startsWith: root.path } }] },
        orderBy: { path: "asc" },
        select: SELECT,
      }),
      // Ancestors are read by id, parsed out of the path, rather than walked parent by parent.
      // Deliberately not filtered by visibility: a breadcrumb for a comment you are allowed to see
      // must not develop holes, and it shows a username and nothing else.
      ancestors.length === 0
        ? Promise.resolve([])
        : db.comment.findMany({
            where: { id: { in: ancestors } },
            orderBy: { path: "asc" },
            select: SELECT,
          }),
    ]);

    const [node] = buildTree(subtreeRows.map(toComment));
    if (!node) return null;

    return { ancestors: ancestorRows.map(toComment), node };
  },
);

export async function getCommentsByAuthor(username: string, opts: ViewerOpts): Promise<Comment[]> {
  const rows = await db.comment.findMany({
    ...JOIN,
    where: { AND: [visibleCommentWhere(opts), { author: { username } }] },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });

  return rows.map(toComment);
}


/**
 * Which page of a thread a comment appears on.
 *
 * Needed because `getThreadPage` paginates top-level comments, and a brand-new comment scores 1 —
 * so `sortSiblings` puts it last. Redirecting to the thread without this landed the author on page 1
 * of 8 and their own comment was nowhere on it, which is how the pagination was found to be broken.
 *
 * A reply is on its *root's* page, since a root carries its whole subtree. The root is the first
 * segment of the comment's `path`, which is what that materialised ancestry is for.
 *
 * One query, counting the roots that sort ahead of it rather than fetching them: the sibling order
 * is `scoreRaw DESC, createdAt ASC`, so "ahead" is a higher score, or an equal score and an earlier
 * timestamp. It must match `sortSiblings` exactly or the page will be off by the number of ties.
 */
export async function pageOfComment(commentId: number, opts: ViewerOpts): Promise<number> {
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: { postId: true, path: true },
  });
  if (!comment) return 1;

  const rootId = Number(comment.path.split(".")[0]);
  const root = await db.comment.findUnique({
    where: { id: rootId },
    select: { scoreRaw: true, createdAt: true },
  });
  if (!root) return 1;

  const ahead = await db.comment.count({
    where: {
      // The same visibility the page applies. Counting every root regardless would put a reader
      // who cannot see dead or shadowed comments on the wrong page, by however many of those sort
      // ahead — and the author of a brand-new comment is exactly such a reader.
      AND: [
        visibleCommentWhere(opts),
        {
          postId: comment.postId,
          parentId: null,
          OR: [
            { scoreRaw: { gt: root.scoreRaw } },
            { scoreRaw: root.scoreRaw, createdAt: { lt: root.createdAt } },
          ],
        },
      ],
    },
  });

  return Math.floor(ahead / CFG.rootsPerPage) + 1;
}
