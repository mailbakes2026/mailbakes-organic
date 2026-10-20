-- Organic account logins. Existing posts, stats and accounts are not rewritten.
CREATE TYPE "ConnectionPlatform" AS ENUM ('META', 'TIKTOK', 'YOUTUBE', 'LINKEDIN', 'SNAPCHAT');
CREATE TYPE "ConnectionState" AS ENUM ('DISCONNECTED', 'CONNECTED', 'NEEDS_RECONNECT');

CREATE TABLE "PlatformConnection" (
  "id" TEXT NOT NULL,
  "platform" "ConnectionPlatform" NOT NULL,
  "status" "ConnectionState" NOT NULL DEFAULT 'DISCONNECTED',
  "accountId" TEXT NOT NULL DEFAULT '',
  "accountName" TEXT NOT NULL DEFAULT '',
  "accountMeta" JSONB NOT NULL DEFAULT '{}',
  "accessTokenEnc" TEXT NOT NULL DEFAULT '',
  "refreshTokenEnc" TEXT NOT NULL DEFAULT '',
  "expiresAt" TIMESTAMP(3),
  "scopes" TEXT NOT NULL DEFAULT '',
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncError" TEXT NOT NULL DEFAULT '',
  "connectedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalPost" (
  "id" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "externalId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "caption" TEXT NOT NULL DEFAULT '',
  "publishedOn" DATE NOT NULL,
  "permalink" TEXT NOT NULL DEFAULT '',
  "views" INTEGER,
  "likes" INTEGER,
  "comments" INTEGER,
  "shares" INTEGER,
  "saves" INTEGER,
  "linkClicks" INTEGER,
  "matchedPostId" TEXT,
  "syncedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FollowerSnapshot" (
  "id" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "day" DATE NOT NULL,
  "followers" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FollowerSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountDayStat" (
  "id" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "day" DATE NOT NULL,
  "views" INTEGER,
  "likes" INTEGER,
  "comments" INTEGER,
  "shares" INTEGER,
  "saves" INTEGER,
  "linkClicks" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountDayStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformConnection_platform_key" ON "PlatformConnection"("platform");
CREATE UNIQUE INDEX "ExternalPost_platform_externalId_key" ON "ExternalPost"("platform", "externalId");
CREATE INDEX "ExternalPost_publishedOn_idx" ON "ExternalPost"("publishedOn");
CREATE INDEX "ExternalPost_matchedPostId_idx" ON "ExternalPost"("matchedPostId");
CREATE UNIQUE INDEX "FollowerSnapshot_platform_day_key" ON "FollowerSnapshot"("platform", "day");
CREATE UNIQUE INDEX "AccountDayStat_platform_day_key" ON "AccountDayStat"("platform", "day");

ALTER TABLE "PlatformConnection" ADD CONSTRAINT "PlatformConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalPost" ADD CONSTRAINT "ExternalPost_matchedPostId_fkey" FOREIGN KEY ("matchedPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
