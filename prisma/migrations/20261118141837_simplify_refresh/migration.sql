-- Replace the refresh function's data-modifying CTE with two plain statements.
--
-- The previous version put the DELETE in a CTE and the INSERT in the outer statement, on the
-- reasoning that one statement means readers never observe an empty table. That reasoning was wrong
-- twice over. A plpgsql function body is already a single transaction, so two statements inside it
-- are equally invisible to readers — the CTE bought nothing. And Postgres documents that
-- data-modifying sub-statements in a WITH clause cannot see one another's effects, so an INSERT of
-- a key the DELETE is removing is, by the letter of the manual, a uniqueness violation waiting to
-- happen. It ran 24 times without one, which makes it luck rather than correctness.
CREATE OR REPLACE FUNCTION "hacker_news_clone".refresh_ranked_posts()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  gravity constant numeric := 1.8;
BEGIN
  -- Rebuilt wholesale rather than updated in place: every score changes every minute because the
  -- denominator is age, so there is no incremental subset to touch. 977 rows took 175 ms.
  DELETE FROM "hacker_news_clone"."RankedPost";

  INSERT INTO "hacker_news_clone"."RankedPost" ("postId", score, "computedAt")
  SELECT p.id,
         (p."scoreRaw" - 1)
           / power(EXTRACT(EPOCH FROM (now() - p."createdAt")) / 3600.0 + 2, gravity),
         now()
  FROM "hacker_news_clone"."Post" p
  JOIN "hacker_news_clone"."User" u ON u.id = p."authorId"
  WHERE p."isDeleted" = false
    AND p."isDead" = false
    AND u."isShadowBanned" = false
    -- The bounded candidate window is what makes this tractable; ARCHITECTURE §6.1.
    AND p."createdAt" > now() - interval '7 days';
END;
$$;

SELECT "hacker_news_clone".refresh_ranked_posts();
