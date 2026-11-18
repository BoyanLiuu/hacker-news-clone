import { describe, expect, it } from "vitest";
import { childPath, segment } from "./path";
import { buildTree, countDescendants, flatten, maxDepth } from "./tree";
import type { Comment } from "./types";

let seq = 0;
function row(opts: { id?: number; parent?: Comment | null; score?: number; minutesAgo?: number }): Comment {
  const id = opts.id ?? ++seq;
  const parent = opts.parent ?? null;
  const path = childPath(parent?.path ?? null, id);
  return {
    id,
    postId: 1,
    parentId: parent?.id ?? null,
    author: "someone",
    text: "body",
    path,
    depth: path.split(".").length - 1,
    scoreRaw: opts.score ?? 1,
    createdAt: new Date(Date.now() - (opts.minutesAgo ?? 0) * 60_000),
    isDead: false,
    isDeleted: false,
    isShadow: false,
  };
}

/** Rows reach buildTree ordered by path, as the query returns them. */
const byPath = (rows: Comment[]) => rows.slice().sort((a, b) => a.path.localeCompare(b.path));

describe("buildTree", () => {
  // Catches: an orphaned comment — parent filtered out by visibility, or rows arriving out of
  // order — dropping its whole subtree from the render instead of surfacing it.
  it("keeps a subtree whose parent is absent from the result set", () => {
    const root = row({ id: 10 });
    const child = row({ id: 20, parent: root });
    const grandchild = row({ id: 30, parent: child });

    // `child` is withheld, as a dead or shadow-banned comment would be.
    const tree = buildTree(byPath([root, grandchild]));

    expect(flatten(tree)).toHaveLength(2);
    expect(flatten(tree).map((n) => n.id).sort()).toEqual([10, 30]);
  });

  // Catches: sorting siblings across different parents, which interleaves branches and scrambles
  // the thread into something that reads as unrelated replies.
  it("sorts siblings only within their own parent", () => {
    const a = row({ id: 10, score: 5 });
    const b = row({ id: 20, score: 50 });
    const a1 = row({ id: 11, parent: a, score: 1 });
    const a2 = row({ id: 12, parent: a, score: 99 });
    const b1 = row({ id: 21, parent: b, score: 2 });

    const tree = buildTree(byPath([a, b, a1, a2, b1]));

    expect(tree.map((n) => n.id)).toEqual([20, 10]); // roots by score
    const ten = tree.find((n) => n.id === 10)!;
    expect(ten.children.map((n) => n.id)).toEqual([12, 11]); // a's children, not b's
    expect(tree.find((n) => n.id === 20)!.children.map((n) => n.id)).toEqual([21]);
  });

  // Catches: an unstable sort shuffling equal-scored replies between renders, so a thread reorders
  // itself on reload for no reason.
  it("breaks score ties by oldest first", () => {
    const older = row({ id: 10, score: 7, minutesAgo: 90 });
    const newer = row({ id: 20, score: 7, minutesAgo: 10 });
    expect(buildTree(byPath([newer, older])).map((n) => n.id)).toEqual([10, 20]);
  });

  it("reports depth and descendant counts for the collapse label and the depth cap", () => {
    const root = row({ id: 10 });
    const child = row({ id: 20, parent: root });
    const grandchild = row({ id: 30, parent: child });
    const tree = buildTree(byPath([root, child, grandchild]));

    expect(maxDepth(tree)).toBe(2);
    expect(countDescendants(tree[0])).toBe(2);
  });
});

describe("path", () => {
  // Catches: padding to fewer digits than int4 needs, so comment 10 sorts before comment 9 and
  // every thread renders in the wrong order.
  it("pads so lexicographic sort equals numeric sort", () => {
    const ids = [9, 10, 100, 2_147_483_647];
    const sorted = ids.map(segment).sort();
    expect(sorted).toEqual(ids.sort((a, b) => a - b).map(segment));
    expect(segment(2_147_483_647)).toHaveLength(10);
  });

  it("nests a child under its parent", () => {
    expect(childPath(null, 7)).toBe("0000000007");
    expect(childPath("0000000007", 12)).toBe("0000000007.0000000012");
  });
});
