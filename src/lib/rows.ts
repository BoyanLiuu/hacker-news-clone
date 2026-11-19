import type { Post } from "./types";

/**
 * The data one listing row needs. Lives here rather than beside the component because
 * `story-row.tsx` is `"use client"`, and a plain function exported from a client module becomes a
 * client *reference*: calling it on the server throws "Attempted to call toRows() from the server".
 *
 * That is not hypothetical. It is how this file came to exist — `tsc`, `eslint` and `next build` all
 * passed while every listing page rendered zero rows, because the failure is a runtime one. The same
 * shape cost M5 a page too, when `TITLE_MAX` came from a client module and rendered as the stub's
 * source text. Non-component exports belong on this side of the boundary.
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
