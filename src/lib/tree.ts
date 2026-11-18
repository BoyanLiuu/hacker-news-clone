import type { Comment, CommentNode } from "./types";

/**
 * Assemble flat rows into a tree in a single pass with a Map, then sort siblings by score.
 *
 * The rows arrive ordered by path, which is already depth-first display order, so no recursion and
 * no nested lookups are needed. Recursive per-node queries are the failure mode this avoids —
 * see ARCHITECTURE §6.2.
 */
export function buildTree(rows: Comment[]): CommentNode[] {
  const byId = new Map<number, CommentNode>();
  for (const row of rows) byId.set(row.id, { ...row, children: [] });

  const roots: CommentNode[] = [];
  for (const row of rows) {
    const node = byId.get(row.id)!;
    const parent = row.parentId === null ? null : byId.get(row.parentId);
    // A comment whose parent is missing from this result set is a root here rather than being
    // dropped — otherwise one absent ancestor silently removes a whole subtree from the render.
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  sortSiblings(roots);
  return roots;
}

/**
 * Score descending, then oldest first so ties are stable.
 * Sorting happens strictly within one parent's children: sorting across parents would interleave
 * branches and scramble the thread.
 */
function sortSiblings(nodes: CommentNode[]): void {
  nodes.sort((a, b) => b.scoreRaw - a.scoreRaw || a.createdAt.getTime() - b.createdAt.getTime());
  for (const node of nodes) sortSiblings(node.children);
}

export function countDescendants(node: CommentNode): number {
  return node.children.reduce((n, child) => n + 1 + countDescendants(child), 0);
}

export function flatten(nodes: CommentNode[]): CommentNode[] {
  const out: CommentNode[] = [];
  const walk = (list: CommentNode[]) => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/** The deepest depth present, for checking the visual cap. Walks without allocating a flat copy. */
export function maxDepth(nodes: CommentNode[]): number {
  let deepest = 0;
  const walk = (list: CommentNode[]) => {
    for (const node of list) {
      if (node.depth > deepest) deepest = node.depth;
      walk(node.children);
    }
  };
  walk(nodes);
  return deepest;
}
