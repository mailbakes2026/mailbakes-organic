-- AlterTable
ALTER TABLE "AdRow" ADD COLUMN "adId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AdRow" ADD COLUMN "adName" TEXT NOT NULL DEFAULT '';

-- RedefineIndex
DROP INDEX "AdRow_platform_level_date_campaignId_adsetId_key";
CREATE UNIQUE INDEX "AdRow_platform_level_date_campaignId_adsetId_adId_key" ON "AdRow"("platform", "level", "date", "campaignId", "adsetId", "adId");
