import { cache } from "react";
import { commentById, comments } from "@/fixtures";
import { ancestorIds, isAtOrBeneath } from "@/lib/path";
import { buildTree } from "@/lib/tree";
import { NotImplementedInStaticPhase, type Comment, type CommentNode, type ViewerOpts } from "@/lib/types";
import { collapseShadow, visibleComment } from "./visibility";

const byPath = (a: Comment, b: Comment) => a.path.localeCompare(b.path);

/**
 * Flat rows in depth-first display order. The fixture equivalent of
 * `findMany({ where: { postId }, orderBy: { path: "asc" } })` — one filter, one sort by path.
 * Same shape phase 2 uses, so M7 swaps a body and nothing else.
 *
 * This is the single source for a thread: `getThread` assembles these rather than querying again,
 * so a page wanting both the tree and the row count pays for one pass.
 */
export const getThreadRows = cache(async (postId: number, opts: ViewerOpts): Promise<Comment[]> => {
  return comments
    .filter((c) => c.postId === postId && visibleComment(c, opts))
    .map(collapseShadow)
    .sort(byPath);
});

export const getThread = cache(async (postId: number, opts: ViewerOpts): Promise<CommentNode[]> => {
  return buildTree(await getThreadRows(postId, opts));
});

/**
 * A comment permalink: the comment and its subtree, plus the ancestors for the breadcrumb.
 * The subtree filter is the fixture form of `path <@ ancestorPath`.
 */
export const getSubtree = cache(
  async (
    commentId: number,
    opts: ViewerOpts,
  ): Promise<{ ancestors: Comment[]; node: CommentNode } | null> => {
    const root = commentById.get(commentId);
    if (!root || !visibleComment(root, opts)) return null;

    const rows = comments
      .filter((c) => c.postId === root.postId && isAtOrBeneath(c.path, root.path) && visibleComment(c, opts))
      .map(collapseShadow)
      .sort(byPath);

    const [node] = buildTree(rows);
    if (!node) return null;

    const wanted = new Set(ancestorIds(root.path));
    const ancestors = comments.filter((c) => wanted.has(c.id)).sort(byPath);

    return { ancestors, node };
  },
);

export async function getCommentsByAuthor(username: string, opts: ViewerOpts): Promise<Comment[]> {
  return comments
    .filter((c) => c.author === username && visibleComment(c, opts))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createComment(_input: {
  postId: number;
  parentId: number | null;
  text: string;
}): Promise<Comment> {
  throw new NotImplementedInStaticPhase("createComment");
}
