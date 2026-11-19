-- The nightly karma recompute. ARCHITECTURE §1.2: `User.karma` is a cache, `Vote` is the truth, and
-- this repairs drift rather than being the thing that maintains it.
--
-- Recomputed from scratch rather than incremented, which Appendix A states as a requirement
-- ("recompute karma from the stored votes, never increment it blindly"). An increment on the vote
-- path would drift on every rolled-back transaction and every unvote that half-applied, and nothing
-- would ever notice.
--
-- Nightly, not per-minute, because nobody reads their own karma that often and the aggregate walks
-- the whole Vote table. The ranking job is the one that has to be fresh.
CREATE OR REPLACE FUNCTION "hacker_news_clone".recompute_karma()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  changed integer;
BEGIN
  -- Karma is votes *received*, so each side resolves the item back to its author. A UNION ALL of
  -- two indexed joins rather than one polymorphic join: `itemId` means a different table depending
  -- on `itemType`, and there is no foreign key that can express that.
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
  -- when votes are withdrawn. Joining `totals` alone would leave a withdrawn vote's karma frozen
  -- at its old value forever, which is the exact drift this job exists to repair.
  target AS (
    SELECT u.id, COALESCE(t.karma, 0) AS karma
    FROM "hacker_news_clone"."User" u
    LEFT JOIN totals t ON t.user_id = u.id
  )
  UPDATE "hacker_news_clone"."User" u
  SET karma = target.karma
  FROM target
  -- Only the rows that actually move. The import left 2 538 users at 0 and most will stay there;
  -- writing them all would dirty every page of the table nightly for no change.
  WHERE u.id = target.id AND u.karma <> target.karma;

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

-- 03:14 UTC: off the hour, because every other cron on a shared database fires on the hour.
-- Schema-prefixed name, because `cron.job` is global to the database and other apps share it.
SELECT cron.schedule(
  'hacker_news_clone:recompute_karma',
  '14 3 * * *',
  $$SELECT "hacker_news_clone".recompute_karma()$$
);

-- Run once now, so karma matches the votes table from this migration onward rather than from the
-- first nightly tick.
SELECT "hacker_news_clone".recompute_karma();
