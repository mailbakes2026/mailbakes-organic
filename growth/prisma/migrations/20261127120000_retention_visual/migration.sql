-- CreateTable
CREATE TABLE "RetentionPulse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capturedOn" TEXT NOT NULL,
    "flowRevenuePence" INTEGER,
    "campaignRevenuePence" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "mixedCurrency" BOOLEAN NOT NULL DEFAULT false,
    "repeatRate" REAL,
    "repeatCustomers" INTEGER,
    "customers" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPulse_capturedOn_key" ON "RetentionPulse"("capturedOn");

-- CreateTable
CREATE TABLE "FlowExperiment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flowId" TEXT NOT NULL DEFAULT '',
    "flowName" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL DEFAULT '',
    "variantA" TEXT NOT NULL DEFAULT '',
    "variantB" TEXT NOT NULL DEFAULT '',
    "splitA" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "winner" TEXT NOT NULL DEFAULT '',
    "metricName" TEXT NOT NULL DEFAULT '',
    "metricA" TEXT NOT NULL DEFAULT '',
    "metricB" TEXT NOT NULL DEFAULT '',
    "lift" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "FlowExperiment_flowId_status_idx" ON "FlowExperiment"("flowId", "status");
