import type { Post } from "./types";

/**
 * The data one listing row needs — and the reason this file exists rather than living beside
 * `story-row.tsx`, which is `"use client"`.
 *
 * A non-component export from a client module is a client *reference*, so calling it on the server
 * throws at runtime while `tsc`, `eslint` and `next build` all pass. This has broken three
 * milestones; see AGENTS.md. Values both sides read belong here, in `src/lib/`.
 */
export type StoryRowData = {
  rank: number;
  points: number;
  post: Post;
};

/**
 * Numbers rows continuously across pages, so page 2 starts at 31 rather than 1. Every listing needs
 * this and they had each been doing the arithmetic inline.
 */
export function toRows<T>(
  items: readonly T[],
  { page, pageSize }: { page: number; pageSize: number },
  unpack: (item: T) => { points: number; post: Post },
): StoryRowData[] {
  return items.map((item, i) => ({ rank: (page - 1) * pageSize + i + 1, ...unpack(item) }));
}
