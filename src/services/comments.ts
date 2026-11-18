import { cache } from "react";
import { db } from "@/lib/db";
import { ancestorIds } from "@/lib/path";
import { buildTree } from "@/lib/tree";
import { NotImplementedInStaticPhase, type Comment, type CommentNode, type ViewerOpts } from "@/lib/types";
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
export const getThreadRows = cache(async (postId: number, opts: ViewerOpts): Promise<Comment[]> => {
  const rows = await db.comment.findMany({
    ...JOIN,
    where: { AND: [visibleCommentWhere(opts), { postId }] },
    orderBy: { path: "asc" },
    select: SELECT,
  });

  return rows.map(toComment);
});

export const getThread = cache(async (postId: number, opts: ViewerOpts): Promise<CommentNode[]> => {
  return buildTree(await getThreadRows(postId, opts));
});

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

export async function createComment(_input: {
  postId: number;
  parentId: number | null;
  text: string;
}): Promise<Comment> {
  // M12 owns this, and it is a transaction rather than an insert: `path` contains the row's own id,
  // which does not exist until the insert returns. Create, then set the path from the new id and
  // the parent's — see `childPath`. The seed exercises exactly that arithmetic over 457 rows.
  throw new NotImplementedInStaticPhase("createComment");
}
