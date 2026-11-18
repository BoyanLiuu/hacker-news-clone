/**
 * Product constants. Values match the approved prototype; the ones the plan leaves open
 * (ARCHITECTURE Appendix G) are marked so a reader knows they are a decision, not a fact.
 */
export const CFG = {
  /** The ranking exponent. The editorial voice lives here — see lib/rank.ts. */
  gravity: 1.8,
  pageSize: 30,
  /**
   * Here, not in the form: a value exported from a `"use client"` module reaches a server component
   * as a client reference, not a number, and interpolates as the stub's source text.
   */
  titleMax: 80,
  /** Visual cap only; the tree is stored to unlimited depth. */
  depthCap: 8,
  /** A URL posted within this window folds into the existing thread. */
  dupDays: 14,
  editMinutes: 120,
  flagsToDie: 5,
  /** Open question: karma-gated downvotes, or none at all. */
  downvoteKarma: 500,
  flagMinDays: 30,
  flagMinKarma: 30,
  ratePerHour: 3,
  ratePerIp: 10,
  /** Only posts younger than this can reach the front page. This bound is what makes ranking tractable. */
  windowDays: 7,
  /** Open question: shorter makes voting feel live and multiplies cache misses. */
  recomputeSeconds: 60,
} as const;

export const HOUR = 3600_000;
export const MINUTE = 60_000;
export const DAY = 24 * HOUR;
