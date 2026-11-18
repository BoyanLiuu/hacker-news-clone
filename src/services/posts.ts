import { cache } from "react";
import { CFG, DAY, HOUR } from "@/lib/config";
import { db } from "@/lib/db";
import { ageHoursBetween, isCandidate, pointsAt, rank } from "@/lib/rank";
import { NotImplementedInStaticPhase, type Page, type Post, type ScoredPost, type ViewerOpts } from "@/lib/types";
import { AUTHOR, toPost } from "./map";
import { reachableAtPermalinkWhere, visiblePostWhere } from "./visibility";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Reads over Postgres. Every signature here is the one phase 1 shipped against — async from the
 * first milestone, `ViewerOpts` on every read — so nothing above this layer changed when the body
 * did. That was the whole bet of ARCHITECTURE Appendix C.
 *
 * The expensive reads are wrapped in `React.cache()` so a page needing the same data twice pays
 * once per request (§5).
 */

const SELECT = {
  id: true,
  title: true,
  url: true,
  text: true,
  domain: true,
  scoreRaw: true,
  commentCount: true,
  createdAt: true,
  editedAt: true,
  isDead: true,
  isDeleted: true,
  author: AUTHOR,
} as const;

/**
 * A page of chronological posts, paginated in Postgres.
 *
 * `skip`/`take` with a `count`, not fetch-everything-and-slice as phase 1 did: that is the point of
 * moving the filter into the database. `/newest` reads 30 rows and one count regardless of how many
 * posts exist, which is what M8's 2 000 stories need.
 */
async function newestPage(
  page: number,
  opts: ViewerOpts,
  extra: Prisma.PostWhereInput = {},
): Promise<Page<Post>> {
  // AND, not a spread. Both sides may set the same key — `visiblePostWhere` contributes `author`
  // for the shadow-ban rule, and a caller may be filtering by author too — and a spread lets the
  // later one silently win. That cost `/user/:name` its username filter once already.
  const where: Prisma.PostWhereInput = { AND: [visiblePostWhere(opts), extra] };
  const pageSize = CFG.pageSize;

  const [rows, total] = await Promise.all([
    db.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: SELECT,
    }),
    db.post.count({ where }),
  ]);

  return {
    items: rows.map(toPost),
    page,
    pageSize,
    total,
    hasNext: (page - 1) * pageSize + pageSize < total,
  };
}

/**
 * Front-page candidates: visible posts inside the 7-day window, scored and sorted.
 *
 * Scored in the application, not in SQL, and deliberately still so after the move to Postgres. The
 * score is non-indexable — it depends on `now()` — which is exactly why M9 exists: a `pg_cron` job
 * writes `RankedPost` and the front page then reads an indexed column. Doing that here would skip
 * the measurement M9 is built around, so this keeps the bounded-window read that makes scoring in
 * the application tractable: the `[createdAt]` index gives Postgres the window, and only those rows
 * are scored.
 *
 * `at` back-projects points for `/front/:date`. This is also what Figure 1 plots.
 */
export const getCandidates = cache(
  async (opts: ViewerOpts, at: Date = new Date(), gravity: number = CFG.gravity): Promise<ScoredPost[]> => {
    const now = new Date();
    const windowStart = new Date(at.getTime() - CFG.windowDays * DAY);

    const rows = await db.post.findMany({
      where: {
        AND: [visiblePostWhere(opts), { createdAt: { lte: at, gte: windowStart } }],
      },
      orderBy: { createdAt: "desc" },
      select: SELECT,
    });

    return rows
      .map(toPost)
      // `isCandidate` is still consulted: the bound above is the index's job, this is the rule's.
      // Stating it in both places is deliberate — the query must not be the only place the window
      // lives, or changing the rule means remembering to change a `where`.
      .filter((post) => isCandidate(post.createdAt, at))
      .map((post) => {
        const points = pointsAt(post.scoreRaw, post.createdAt, at, now);
        const ageHours = ageHoursBetween(post.createdAt, at);
        return { post, points, ageHours, score: rank(points, ageHours, gravity) };
      })
      .sort((a, b) => b.score - a.score);
  },
);

export async function getRankedPage(page: number, opts: ViewerOpts, at?: Date): Promise<Page<ScoredPost>> {
  // Paged in memory, because the sort key is computed. M9 moves this to `RankedPost` and an
  // indexed `ORDER BY score DESC` with real `skip`/`take`.
  const all = await getCandidates(opts, at ?? new Date());
  const start = (page - 1) * CFG.pageSize;
  return {
    items: all.slice(start, start + CFG.pageSize),
    page,
    pageSize: CFG.pageSize,
    total: all.length,
    hasNext: start + CFG.pageSize < all.length,
  };
}

export async function getNewestPage(page: number, opts: ViewerOpts): Promise<Page<Post>> {
  return newestPage(page, opts);
}

export async function getPostsByDomain(domain: string, page: number, opts: ViewerOpts): Promise<Page<Post>> {
  const needle = domain.toLowerCase().replace(/^www\./, "");
  // Served by the `[domain, createdAt]` index — the reason that index exists.
  return newestPage(page, opts, { domain: needle });
}

/** A dead post is reachable here even though listings hide it. */
export const getPostById = cache(async (id: number, opts: ViewerOpts): Promise<Post | null> => {
  const row = await db.post.findFirst({
    where: { AND: [reachableAtPermalinkWhere(opts), { id }] },
    select: SELECT,
  });

  return row ? toPost(row) : null;
});

export async function getPostsByAuthor(username: string, opts: ViewerOpts): Promise<Post[]> {
  const rows = await db.post.findMany({
    where: { AND: [visiblePostWhere(opts), { author: { username } }] },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });

  return rows.map(toPost);
}

/** True when this URL was already posted inside the duplicate window — M12 redirects to it. */
export async function findDuplicate(url: string, opts: ViewerOpts): Promise<Post | null> {
  const row = await db.post.findFirst({
    where: {
      AND: [
        visiblePostWhere(opts),
        { url, createdAt: { gte: new Date(Date.now() - CFG.dupDays * DAY) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });

  return row ? toPost(row) : null;
}

/**
 * How much of the hourly submission allowance the viewer has spent.
 *
 * Counted over a rolling hour, so the allowance returns one slot at a time rather than resetting in
 * a batch on the hour — a batch reset invites everyone to queue for it. Deleted and dead posts still
 * count, which is why this does not use `visiblePostWhere`: deleting a submission must not refund
 * the attempt, or the limit buys nothing.
 *
 * M12 enforces it inside the action. This is the read the form needs to say so before you type.
 *
 * Cached per request because `/submit` asks twice — the form, for the notice, and the rules aside,
 * for the "this hour" row. `getViewerOpts` is itself cached, so both callers pass one object.
 */
export type SubmitQuota = {
  used: number;
  limit: number;
  /** When the next slot frees, or null when none is spent. */
  resetAt: Date | null;
};

export const getSubmitQuota = cache(async (opts: ViewerOpts): Promise<SubmitQuota> => {
  if (!opts.userId) return { used: 0, limit: CFG.ratePerHour, resetAt: null };

  const since = new Date(Date.now() - HOUR);
  const spent: Prisma.PostWhereInput = { author: { username: opts.userId }, createdAt: { gte: since } };

  const [used, oldest] = await Promise.all([
    db.post.count({ where: spent }),
    db.post.findFirst({ where: spent, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);

  return {
    used,
    limit: CFG.ratePerHour,
    resetAt: oldest ? new Date(oldest.createdAt.getTime() + HOUR) : null,
  };
});

/* Mutations are declared so callers can be written against them now. Forms render and validate;
   they cannot persist until M12 brings the actions and M10 brings the session they act as. */

export async function submitPost(_input: { title: string; url?: string; text?: string }): Promise<Post> {
  throw new NotImplementedInStaticPhase("submitPost");
}

export async function editPost(_id: number, _input: { title: string; text?: string }): Promise<Post> {
  throw new NotImplementedInStaticPhase("editPost");
}

export async function deletePost(_id: number): Promise<void> {
  throw new NotImplementedInStaticPhase("deletePost");
}
