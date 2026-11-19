/**
 * What a vote submission does to a vote that may already exist.
 *
 * Pure and separate from the action because this is where the one real bug in M11 lived: the grace
 * window was consulted on the same-arrow branch only, so flipping an old upvote to a downvote and
 * back was an unvote-and-revote the window never saw. A decision spread across the branches of a
 * database transaction is a decision nothing can test.
 */
export type Existing = { value: 1 | -1; createdAt: Date };

export type VoteDecision =
  /** No vote yet: record one, score moves by `direction`. */
  | { kind: "cast"; delta: 1 | -1 }
  /** Same arrow inside the window: remove it, score moves back. */
  | { kind: "unvote"; delta: 1 | -1 }
  /** Other arrow inside the window: replace it, score moves by two — off the old, on the new. */
  | { kind: "switch"; delta: 2 | -2 }
  /** Window closed. The vote stands and nothing happens, whichever arrow was clicked. */
  | { kind: "locked" };

export function decideVote({
  existing,
  direction,
  graceMs,
  now = Date.now(),
}: {
  existing: Existing | null;
  direction: 1 | -1;
  graceMs: number;
  now?: number;
}): VoteDecision {
  if (!existing) return { kind: "cast", delta: direction };

  if (now - existing.createdAt.getTime() >= graceMs) return { kind: "locked" };

  if (existing.value === direction) return { kind: "unvote", delta: -direction as 1 | -1 };

  return { kind: "switch", delta: (direction * 2) as 2 | -2 };
}
