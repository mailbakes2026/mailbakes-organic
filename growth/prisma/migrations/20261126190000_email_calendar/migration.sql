-- CreateTable
CREATE TABLE "CalendarCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seedKey" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sendDate" TEXT NOT NULL,
    "sendTime" TEXT NOT NULL DEFAULT '',
    "timeLabel" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "previewText" TEXT NOT NULL DEFAULT '',
    "audience" TEXT NOT NULL DEFAULT '',
    "audienceSize" INTEGER,
    "smartSending" BOOLEAN,
    "offerCode" TEXT NOT NULL DEFAULT '',
    "klaviyoCampaignId" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "cardNote" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "openRate" REAL,
    "clickRate" REAL,
    "revenuePence" INTEGER,
    "orders" INTEGER,
    "recipients" INTEGER,
    "delivered" INTEGER,
    "opens" INTEGER,
    "clicks" INTEGER,
    "unsubscribes" INTEGER,
    "unsubscribeRate" REAL,
    "bounces" INTEGER,
    "bounceRate" REAL,
    "spamComplaints" INTEGER,
    "spamRate" REAL,
    "conversionRate" REAL,
    "aovPence" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "attributionModel" TEXT NOT NULL DEFAULT '',
    "attributionDetail" TEXT NOT NULL DEFAULT '',
    "resultsSource" TEXT NOT NULL DEFAULT '',
    "resultsSyncedAt" DATETIME,
    "resultsError" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CalendarOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seedKey" TEXT,
    "label" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT 'pink',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CalendarDayTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seedKey" TEXT,
    "date" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DesignAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BLOB NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DesignAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CalendarCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalendarSeedMark" (
    "seedKey" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "verdict" TEXT NOT NULL DEFAULT 'comment',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewComment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CalendarCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarCampaign_seedKey_key" ON "CalendarCampaign"("seedKey");

-- CreateIndex
CREATE INDEX "CalendarCampaign_sendDate_sort_idx" ON "CalendarCampaign"("sendDate", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarOffer_seedKey_key" ON "CalendarOffer"("seedKey");

-- CreateIndex
CREATE INDEX "CalendarOffer_startDate_endDate_idx" ON "CalendarOffer"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDayTag_seedKey_key" ON "CalendarDayTag"("seedKey");

-- CreateIndex
CREATE INDEX "CalendarDayTag_date_idx" ON "CalendarDayTag"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDayTag_date_label_key" ON "CalendarDayTag"("date", "label");

-- CreateIndex
CREATE INDEX "DesignAsset_campaignId_createdAt_idx" ON "DesignAsset"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewComment_campaignId_createdAt_idx" ON "ReviewComment"("campaignId", "createdAt");
