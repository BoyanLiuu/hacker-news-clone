-- Move every object into this app's own schema.
--
-- WHY: one Supabase project is one Postgres database, and the free tier allows two projects. To let
-- several side projects share a project, each app owns a schema instead of competing for table
-- names in `public`. That is the pattern Supabase itself uses one level up — its own tables live in
-- `auth`, `storage` and `realtime`, not as `auth_users` in a shared namespace.
-- ARCHITECTURE Appendix D records the decision.
--
-- HOW: `SET SCHEMA`, not create-and-copy. It relinks the existing table, so rows, indexes,
-- constraints, owned sequences and the RLS flag all travel with it and nothing is rewritten. A
-- Prisma-generated migration would instead have produced seven CREATE TABLEs against the new schema
-- and left the old ones orphaned, which is why this one is written by hand.
CREATE SCHEMA IF NOT EXISTS "hacker_news_clone";

-- The enum first: the tables depend on the type, and moving it afterwards leaves them pointing at
-- `public."ItemType"`.
ALTER TYPE "public"."ItemType" SET SCHEMA "hacker_news_clone";

-- Order is irrelevant for SET SCHEMA — foreign keys follow the tables rather than breaking — but
-- parents are listed first to match the shape of the model.
ALTER TABLE "public"."User" SET SCHEMA "hacker_news_clone";
ALTER TABLE "public"."Post" SET SCHEMA "hacker_news_clone";
ALTER TABLE "public"."Comment" SET SCHEMA "hacker_news_clone";
ALTER TABLE "public"."Vote" SET SCHEMA "hacker_news_clone";
ALTER TABLE "public"."Flag" SET SCHEMA "hacker_news_clone";
ALTER TABLE "public"."RankedPost" SET SCHEMA "hacker_news_clone";
ALTER TABLE "public"."FrontSnapshot" SET SCHEMA "hacker_news_clone";
