-- Per-platform performance numbers. No existing post or account rows are rewritten.
CREATE TYPE "StatSource" AS ENUM ('MANUAL', 'API');

CREATE TABLE "PostStat" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "views" INTEGER,
  "likes" INTEGER,
  "comments" INTEGER,
  "shares" INTEGER,
  "saves" INTEGER,
  "linkClicks" INTEGER,
  "source" "StatSource" NOT NULL DEFAULT 'MANUAL',
  "syncedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PostStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostStat_postId_platform_key" ON "PostStat"("postId", "platform");
CREATE INDEX "PostStat_postId_idx" ON "PostStat"("postId");

ALTER TABLE "PostStat" ADD CONSTRAINT "PostStat_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
