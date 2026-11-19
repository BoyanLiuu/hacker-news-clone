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
  /**
   * Top-level comments rendered per page of a thread. M14's bound on thread cost.
   *
   * Measured on a generated 1 000-comment thread: 44.7 ms of query against a 263 ms render and
   * 176.5 KB gz of HTML, so the render and the document — not the database — are what a huge
   * thread costs. `depthCap` bounds how deep a page goes; this bounds how wide.
   *
   * 40 rather than `pageSize`'s 30: a root comment is one line plus its replies, so 40 roots is
   * already a longer document than 30 story rows, and most threads have fewer roots than this and
   * are unaffected.
   */
  rootsPerPage: 40,
  /**
   * The reply textarea has carried `maxLength={10_000}` since M5; this is that number, named, so
   * the action and the field cannot drift. A browser's maxLength is not a limit a server may trust.
   */
  commentMax: 10_000,
  /** A URL posted within this window folds into the existing thread. */
  dupDays: 14,
  editMinutes: 120,
  flagsToDie: 5,
  /**
   * Resolved in M11: karma-gated comment downvotes, HN's model. Posts take upvotes only.
   *
   * No account can reach this yet. Karma counts votes cast on Tally, and the HN import brought no
   * vote history, so every imported account sits at 0 — the control is enforced and correct, and
   * invisible until the site has traffic. Lowering it would make the feature demonstrable and the
   * moderation model a fiction; the number stays honest.
   */
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
