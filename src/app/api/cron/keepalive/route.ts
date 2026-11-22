import { db } from "@/lib/db";

/**
 * One cheap read a day, so Supabase never sees a week of silence.
 *
 * A free Supabase project pauses after about a week without activity and stays paused until someone
 * resumes it from the dashboard. Nothing else here prevents that:
 *
 *   - The `pg_cron` jobs in this database (`hacker_news_clone:refresh_ranked_posts` every minute,
 *     `:recompute_karma` nightly) run *inside* Postgres, so they arrive as no request at all — and
 *     when a project pauses, Postgres stops with it and they stop too. Jobs that die on pause
 *     cannot be the thing that prevents pause.
 *   - Visitor traffic does not reliably reach the database either. The signed-out front page is
 *     wrapped in `unstable_cache` (`src/services/posts.ts`), so a visit inside the revalidate
 *     window is served without a query.
 *
 * Hence a scheduled request from outside, which is what `vercel.json` adds.
 *
 * Read-only on purpose. There is nothing to clean up on a schedule here, and a query is activity on
 * its own, so no product data moves.
 */

/** `refresh_ranked_posts` is scheduled `* * * * *`, so ten minutes is many missed ticks, not jitter. */
const STALE_AFTER_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Fail closed. A missing secret is a misconfiguration, and the wrong response to one is to serve
  // database work to whoever finds the URL.
  if (!secret) {
    console.error("CRON_SECRET is not set; refusing to run the keepalive.");
    return Response.json({ error: "not configured" }, { status: 503 });
  }

  // Vercel Cron sends the secret as a bearer token, which it does automatically once `CRON_SECRET`
  // is set on the project. Compared in full, and the failure says nothing about which part was wrong.
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // `RankedPost` rather than a bare `SELECT 1`: the same single round trip, but the freshest
  // `computedAt` also reveals whether the every-minute ranking job is still running. That failure is
  // otherwise invisible — the front page keeps rendering, just ranked on frozen scores.
  const { _max, _count } = await db.rankedPost.aggregate({
    _max: { computedAt: true },
    _count: true,
  });

  const computedAt = _max.computedAt;
  const stale = computedAt === null || Date.now() - computedAt.getTime() > STALE_AFTER_MS;

  // Logged because this is the only record that it ran: there is no user to tell and nothing in the
  // UI changes.
  if (stale) {
    console.error(
      `Keepalive ran, but RankedPost is stale (computedAt=${computedAt?.toISOString() ?? "empty"}). ` +
        "Check `SELECT * FROM cron.job_run_details` — refresh_ranked_posts has stopped ticking.",
    );
  } else {
    console.log(`Keepalive ran: ${_count} ranked posts, computed ${computedAt.toISOString()}.`);
  }

  return Response.json({
    ranked: _count,
    computedAt: computedAt?.toISOString() ?? null,
    stale,
  });
}
