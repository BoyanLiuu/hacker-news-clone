-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('POST', 'COMMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "clerkId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "about" TEXT NOT NULL DEFAULT '',
    "karma" INTEGER NOT NULL DEFAULT 0,
    "isModerator" BOOLEAN NOT NULL DEFAULT false,
    "isShadowBanned" BOOLEAN NOT NULL DEFAULT false,
    "showDead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "authorId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "text" TEXT,
    "domain" TEXT,
    "scoreRaw" INTEGER NOT NULL DEFAULT 1,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "isDead" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "authorId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "scoreRaw" INTEGER NOT NULL DEFAULT 1,
    "childCount" INTEGER NOT NULL DEFAULT 0,
    "isDead" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isShadow" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "userId" INTEGER NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "itemId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("userId","itemType","itemId")
);

-- CreateTable
CREATE TABLE "Flag" (
    "userId" INTEGER NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "itemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Flag_pkey" PRIMARY KEY ("userId","itemType","itemId")
);

-- CreateTable
CREATE TABLE "RankedPost" (
    "postId" INTEGER NOT NULL,
    "score" DECIMAL(65,30) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankedPost_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "FrontSnapshot" (
    "date" TIMESTAMP(3) NOT NULL,
    "postId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "FrontSnapshot_pkey" PRIMARY KEY ("date","postId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Post_domain_createdAt_idx" ON "Post"("domain", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");

-- CreateIndex
CREATE INDEX "Comment_postId_path_idx" ON "Comment"("postId", "path");

-- CreateIndex
CREATE INDEX "Comment_path_idx" ON "Comment"("path");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "RankedPost_score_idx" ON "RankedPost"("score" DESC);

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankedPost" ADD CONSTRAINT "RankedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Row Level Security: enabled on every table, with no policies at all.
--
-- This is a backstop, not the authorization model. Prisma connects as the table owner, and a table
-- owner bypasses RLS, so application queries are unaffected. What it buys is that Supabase's
-- `anon` and `authenticated` roles — the ones reachable with the publishable key that ships in a
-- browser — can read nothing, because "RLS on with zero policies" denies by default.
--
-- Ownership checks live in the service layer with explicit filters (ARCHITECTURE Appendix D). If
-- this is ever the only thing standing between a leaked key and the data, something above has
-- already failed.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Flag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RankedPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FrontSnapshot" ENABLE ROW LEVEL SECURITY;
