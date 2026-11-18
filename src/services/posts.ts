import { unstable_cache } from "next/cache";
import { cache } from "react";
import { CFG, DAY, HOUR } from "@/lib/config";
import { db } from "@/lib/db";
import { ageHoursBetween, isCandidate, rank } from "@/lib/rank";
import { ANONYMOUS, NotImplementedInStaticPhase, type Page, type Post, type ScoredPost, type ViewerOpts } from "@/lib/types";
import { AUTHOR, JOIN, toPost } from "./map";
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
      ...JOIN,
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
 * This is what Figure 1 plots. There is no longer an `at` parameter: `/front/:date` is gone
 * (Appendix G, Q4), and it was the only caller that asked for a past moment.
 */
export const getCandidates = cache(
  async (opts: ViewerOpts, gravity: number = CFG.gravity): Promise<ScoredPost[]> => {
    const at = new Date();
    const windowStart = new Date(at.getTime() - CFG.windowDays * DAY);

    const rows = await db.post.findMany({
      ...JOIN,
      where: {
        AND: [visiblePostWhere(opts), { createdAt: { gte: windowStart } }],
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
        const points = post.scoreRaw;
        const ageHours = ageHoursBetween(post.createdAt, at);
        return { post, points, ageHours, score: rank(points, ageHours, gravity) };
      })
      .sort((a, b) => b.score - a.score);
  },
);

/**
 * When the ranking was last computed, and whether that is behind.
 *
 * This is the real reason `RankedPost` exists, and it is not performance. `ux-24` turns the document
 * line amber when the ordering is behind, and until something *recorded* when it was computed there
 * was no honest way to render that — M5 left it hardcoded `false` rather than invent a value.
 * Inline scoring is always "now" by construction and so can never be stale, which sounds like a
 * feature and is actually the absence of the measurement.
 *
 * `stale` is decided here rather than in the header for the reason M5 learned with `getViewer`: it
 * depends on the clock, the React compiler rejects `Date.now()` during render, and a rule computed
 * per component can disagree with itself across one page. Cached, so every consumer sees one answer.
 *
 * Behind means older than **twice** the recompute interval. One missed tick is ordinary jitter for a
 * minute-scheduled job, and amber for that would make the indicator noise; two means the job is not
 * running, which is worth saying on every page.
 */
export type RankingFreshness = { at: Date | null; stale: boolean };

export const getRankingFreshness = cache(async (): Promise<RankingFreshness> => {
  const row = await db.rankedPost.aggregate({ _max: { computedAt: true } });
  const at = row._max.computedAt ?? null;

  return {
    at,
    // Never having run is its own kind of stale, and the louder one.
    stale: at === null || Date.now() - at.getTime() > 2 * CFG.recomputeSeconds * 1000,
  };
});

/**
 * The front page: an index scan on `RankedPost(score DESC)`, paginated in Postgres.
 *
 * **Measured before it was built** — ARCHITECTURE Appendix B insisted on comparing both shapes at
 * real data size rather than materialising on faith. Against 977 posts in the window:
 *
 * | | DB execution | round trip |
 * |---|---|---|
 * | inline, score and sort in SQL | 23.25 ms | 135.1 ms |
 * | materialised, index scan | **0.255 ms** | **112.6 ms** |
 *
 * 91x less database work, and only ~17% faster end to end, because a Supabase round trip is ~110 ms
 * and latency dominates. So read speed is a secondary reason at this size; `getRankedAt` above is
 * the primary one, and the scaling is the third — the inline sort grows with the window while an
 * index scan does not.
 *
 * There is no `at` parameter any more. `/front/:date` was the only caller that wanted a past
 * ordering, and it is gone — Appendix G, Q4.
 */
/**
 * The front page, cached across requests for 60 s — matching `CFG.recomputeSeconds`, because the
 * underlying ordering cannot change faster than the job that writes it.
 *
 * **Only the signed-out view is cached, and that restriction is the point.** The query depends on
 * three per-viewer inputs: `showDead`, `isModerator`, and `userId` (a shadow-banned author sees
 * their own posts). Caching it without those in the key would serve one reader's visibility to
 * another — a moderator's dead rows to an anonymous visitor is the worst version of that. Including
 * them in the key would instead mean a cache entry per signed-in user, which is a memory leak
 * dressed as an optimisation.
 *
 * Signed-out is where the traffic is and where the data is identical for everyone, so it takes the
 * cache; signed-in readers pay the query. `React.cache()` still dedupes within a single request for
 * both.
 *
 * **`unstable_cache` serialises through JSON, so `Date` fields come back as strings.** Without the
 * revive below, `formatAge` calls `.getTime()` on a string and the row throws — and because the list
 * renders inside a Suspense boundary, the boundary swallows it and the page shows its skeleton
 * forever rather than an error. A cache that silently turns a page blank is worse than no cache, so
 * the revive is not optional tidying.
 */
const cachedSignedOutPage = unstable_cache(
  async (page: number) => rankedPageFromTable(page, ANONYMOUS),
  ["ranked-page"],
  { revalidate: CFG.recomputeSeconds },
);

/** Restore the `Date`s JSON flattened to strings. Both fields, or `editedAt` breaks the edit window. */
function reviveDates(page: Page<ScoredPost>): Page<ScoredPost> {
  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      post: {
        ...item.post,
        createdAt: new Date(item.post.createdAt),
        editedAt: item.post.editedAt === null ? null : new Date(item.post.editedAt),
      },
    })),
  };
}

export async function getRankedPage(page: number, opts: ViewerOpts): Promise<Page<ScoredPost>> {
  // Signed out and asking for the live ordering: the one case worth caching.
  if (opts.userId === null && !opts.isModerator && !opts.showDead) {
    return reviveDates(await cachedSignedOutPage(page));
  }

  return rankedPageFromTable(page, opts);
}

async function rankedPageFromTable(page: number, opts: ViewerOpts): Promise<Page<ScoredPost>> {
  // Visibility is re-applied here rather than trusted from the job. The job filters the same three
  // rules, but it ran up to a minute ago and `showDead` is per-viewer, which no shared table can
  // encode.
  const where: Prisma.RankedPostWhereInput = { post: visiblePostWhere(opts) };
  const pageSize = CFG.pageSize;

  // Two round trips, not three. `computedAt` arrives with the rows, so asking
  // `getRankingFreshness()` here as well would have added a whole trip for a value already in hand —
  // and at ~105 ms to Supabase a trip costs 400x what the query inside it costs (0.26 ms measured).
  // The header calls it separately because it renders in its own Suspense boundary.
  const [rows, total] = await Promise.all([
    db.rankedPost.findMany({
      ...JOIN,
      where,
      orderBy: { score: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { score: true, computedAt: true, post: { select: SELECT } },
    }),
    db.rankedPost.count({ where }),
  ]);

  const asOf = rows[0]?.computedAt ?? new Date();

  return {
    items: rows.map((row) => {
      const post = toPost(row.post);
      return {
        post,
        points: post.scoreRaw,
        // Age as of the computation, so the printed arithmetic reproduces the stored score.
        ageHours: ageHoursBetween(post.createdAt, asOf),
        score: Number(row.score),
      };
    }),
    page,
    pageSize,
    total,
    hasNext: (page - 1) * pageSize + pageSize < total,
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
    ...JOIN,
    where: { AND: [reachableAtPermalinkWhere(opts), { id }] },
    select: SELECT,
  });

  return row ? toPost(row) : null;
});

export async function getPostsByAuthor(username: string, opts: ViewerOpts): Promise<Post[]> {
  const rows = await db.post.findMany({
    ...JOIN,
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
