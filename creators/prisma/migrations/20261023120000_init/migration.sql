-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('INQUIRY', 'APPROVED', 'MESSAGE_NEEDED', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'POSTED', 'DECLINED', 'ON_HOLD');

-- CreateTable
CREATE TABLE "AppMeta" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "shopifyOrder" TEXT NOT NULL DEFAULT '',
    "stage" "Stage" NOT NULL DEFAULT 'INQUIRY',
    "rush" BOOLEAN NOT NULL DEFAULT false,
    "cardMessage" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "shipDate" DATE,
    "courier" TEXT NOT NULL DEFAULT '',
    "trackingNumber" TEXT NOT NULL DEFAULT '',
    "declineReason" TEXT NOT NULL DEFAULT '',
    "posted" BOOLEAN NOT NULL DEFAULT false,
    "postUrl" TEXT NOT NULL DEFAULT '',
    "views" INTEGER,
    "orders" INTEGER,
    "rating" INTEGER,
    "worksWell" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Creator_stage_idx" ON "Creator"("stage");

-- CreateIndex
CREATE INDEX "Creator_shipDate_idx" ON "Creator"("shipDate");

-- CreateIndex
CREATE INDEX "Creator_rush_idx" ON "Creator"("rush");

-- CreateIndex
CREATE INDEX "Activity_creatorId_createdAt_idx" ON "Activity"("creatorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

