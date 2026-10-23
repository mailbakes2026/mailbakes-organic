-- CreateTable
CREATE TABLE "AdRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL DEFAULT '',
    "campaignName" TEXT NOT NULL DEFAULT '',
    "adsetId" TEXT NOT NULL DEFAULT '',
    "adsetName" TEXT NOT NULL DEFAULT '',
    "spendPence" INTEGER NOT NULL,
    "revenuePence" INTEGER NOT NULL,
    "orders" INTEGER NOT NULL,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BudgetChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "objectId" TEXT NOT NULL DEFAULT '',
    "objectName" TEXT NOT NULL,
    "previousPence" INTEGER,
    "nextPence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "app" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "syncedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FlowStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flowId" TEXT NOT NULL,
    "flowName" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "revenuePence" INTEGER,
    "opens" INTEGER,
    "clicks" INTEGER,
    "delivered" INTEGER,
    "unsubscribes" INTEGER,
    "openRate" REAL,
    "clickRate" REAL,
    "currency" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CampaignStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "revenuePence" INTEGER,
    "opens" INTEGER,
    "clicks" INTEGER,
    "delivered" INTEGER,
    "unsubscribes" INTEGER,
    "openRate" REAL,
    "clickRate" REAL,
    "currency" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ListSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "listName" TEXT NOT NULL,
    "profiles" INTEGER,
    "capturedOn" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShopifyOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL DEFAULT '',
    "orderedOn" TEXT NOT NULL,
    "totalPence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quarter" TEXT NOT NULL DEFAULT '2026-Q4',
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "decision" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "ownerName" TEXT NOT NULL DEFAULT 'Kyle',
    "ownerEmail" TEXT NOT NULL DEFAULT 'kyle@flowsha.com',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AdRow_platform_date_idx" ON "AdRow"("platform", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AdRow_platform_level_date_campaignId_adsetId_key" ON "AdRow"("platform", "level", "date", "campaignId", "adsetId");

-- CreateIndex
CREATE INDEX "BudgetChange_platform_day_idx" ON "BudgetChange"("platform", "day");

-- CreateIndex
CREATE INDEX "Note_app_kind_createdAt_idx" ON "Note"("app", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "FlowStat_window_idx" ON "FlowStat"("window");

-- CreateIndex
CREATE UNIQUE INDEX "FlowStat_flowId_window_source_key" ON "FlowStat"("flowId", "window", "source");

-- CreateIndex
CREATE INDEX "CampaignStat_window_idx" ON "CampaignStat"("window");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignStat_campaignId_window_source_key" ON "CampaignStat"("campaignId", "window", "source");

-- CreateIndex
CREATE INDEX "ListSnapshot_capturedOn_idx" ON "ListSnapshot"("capturedOn");

-- CreateIndex
CREATE UNIQUE INDEX "ListSnapshot_listId_capturedOn_source_key" ON "ListSnapshot"("listId", "capturedOn", "source");

-- CreateIndex
CREATE INDEX "ShopifyOrder_orderedOn_idx" ON "ShopifyOrder"("orderedOn");

-- CreateIndex
CREATE INDEX "ShopifyOrder_customerId_idx" ON "ShopifyOrder"("customerId");

-- CreateIndex
CREATE INDEX "PlanItem_quarter_sort_idx" ON "PlanItem"("quarter", "sort");

