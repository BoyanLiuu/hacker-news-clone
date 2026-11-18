-- The ranking job: materialise the time-decay score, refreshed every minute.
--
-- MEASURED, not assumed — ARCHITECTURE Appendix B required both shapes be compared at real data
-- size before one was kept. Against 1 380 stories with 977 inside the 7-day window:
--
--   inline, score and sort in SQL   23.25 ms execution   135.1 ms round trip
--   materialised, index scan         0.255 ms execution   112.6 ms round trip
--
-- 91x less database work, but only ~17% faster end to end, because a round trip to Supabase is
-- ~110 ms and latency dominates. The read speed is therefore *not* the reason this won; see the
-- `computedAt` note below for what is.
--
-- pg_cron is installed into a database shared with other apps. That is additive and the job touches
-- only this schema, but it is worth knowing it was not there before this migration.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- One function, so the schedule stays a one-liner and the logic is versioned here rather than
-- living only inside a cron table nobody diffs.
--
-- Rebuilt wholesale rather than updated in place: every score changes every minute because the
-- denominator is age, so there is no incremental subset to touch. 977 rows took 175 ms.
CREATE OR REPLACE FUNCTION "hacker_news_clone".refresh_ranked_posts()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  gravity constant numeric := 1.8;
BEGIN
  -- A single statement, so readers never see an empty table: the delete and the insert commit
  -- together. TRUNCATE would be faster but takes an ACCESS EXCLUSIVE lock, which would block the
  -- front page for the duration.
  WITH scored AS (
    SELECT p.id AS post_id,
           (p."scoreRaw" - 1)
             / power(EXTRACT(EPOCH FROM (now() - p."createdAt")) / 3600.0 + 2, gravity) AS score
    FROM "hacker_news_clone"."Post" p
    JOIN "hacker_news_clone"."User" u ON u.id = p."authorId"
    WHERE p."isDeleted" = false
      AND p."isDead" = false
      AND u."isShadowBanned" = false
      -- The bounded candidate window is what makes this tractable; ARCHITECTURE §6.1.
      AND p."createdAt" > now() - interval '7 days'
  ),
  cleared AS (
    DELETE FROM "hacker_news_clone"."RankedPost" RETURNING 1
  )
  INSERT INTO "hacker_news_clone"."RankedPost" ("postId", score, "computedAt")
  SELECT post_id, score, now() FROM scored
  WHERE (SELECT count(*) FROM cleared) >= 0;
END;
$$;

-- Every minute, matching CFG.recomputeSeconds. The job name is schema-prefixed because other apps
-- share this database and `cron.job` is global to it.
SELECT cron.schedule(
  'hacker_news_clone:refresh_ranked_posts',
  '* * * * *',
  $$SELECT "hacker_news_clone".refresh_ranked_posts()$$
);

-- Populate immediately, so the front page is not empty until the first tick.
SELECT "hacker_news_clone".refresh_ranked_posts();
