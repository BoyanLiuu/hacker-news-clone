-- The per-network submission limit's counter.
--
-- The per-user limit needs no table: getSubmitQuota counts the viewer's own posts in the last hour,
-- so the posts *are* the record. An IP has no rows of its own, and the limit has to hold across
-- serverless instances and survive a deploy, which rules out an in-process map — on Vercel that
-- would make the real limit 10 x instances.
--
-- `network` is a truncated prefix (/24 IPv4, /48 IPv6), never an address. See the RateHit model.
CREATE TABLE "hacker_news_clone"."RateHit" (
  "id"        SERIAL       NOT NULL,
  "network"   TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RateHit_pkey" PRIMARY KEY ("id")
);

-- (network, createdAt) and not (network): every read is "this network, since an hour ago", so the
-- timestamp belongs in the index or each check degrades to scanning one network's whole history.
CREATE INDEX "RateHit_network_createdAt_idx"
  ON "hacker_news_clone"."RateHit" ("network", "createdAt");

-- Pruning rides on the nightly karma job rather than taking a schedule of its own: nothing reads a
-- row older than an hour, two cron entries for one app is one more than the shared database needs,
-- and a table that only grows is how a rate limiter becomes the outage.
CREATE OR REPLACE FUNCTION "hacker_news_clone".recompute_karma()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  changed integer;
BEGIN
  WITH received AS (
    SELECT p."authorId" AS user_id, v.value
    FROM "hacker_news_clone"."Vote" v
    JOIN "hacker_news_clone"."Post" p ON p.id = v."itemId"
    WHERE v."itemType" = 'POST'

    UNION ALL

    SELECT c."authorId" AS user_id, v.value
    FROM "hacker_news_clone"."Vote" v
    JOIN "hacker_news_clone"."Comment" c ON c.id = v."itemId"
    WHERE v."itemType" = 'COMMENT'
  ),
  totals AS (
    SELECT user_id, SUM(value)::integer AS karma FROM received GROUP BY user_id
  ),
  -- Every user, not only those with votes: a LEFT JOIN is what lets karma fall back *down* to 0
  -- when votes are withdrawn.
  target AS (
    SELECT u.id, COALESCE(t.karma, 0) AS karma
    FROM "hacker_news_clone"."User" u
    LEFT JOIN totals t ON t.user_id = u.id
  )
  UPDATE "hacker_news_clone"."User" u
  SET karma = target.karma
  FROM target
  WHERE u.id = target.id AND u.karma <> target.karma;

  GET DIAGNOSTICS changed = ROW_COUNT;

  -- A day's margin over the hour anything is read for, so a clock skew cannot drop a live row.
  DELETE FROM "hacker_news_clone"."RateHit" WHERE "createdAt" < now() - interval '1 day';

  RETURN changed;
END;
$$;

