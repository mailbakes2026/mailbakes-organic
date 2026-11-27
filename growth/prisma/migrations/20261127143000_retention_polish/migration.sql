-- AlterTable
ALTER TABLE "FlowStat" ADD COLUMN "status" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "CampaignPreview" (
    "campaignId" TEXT NOT NULL PRIMARY KEY,
    "html" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
