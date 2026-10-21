-- Payslip filing. Staff rows store a name and a Drive folder id only.
CREATE TYPE "PayslipOutcome" AS ENUM ('FILED', 'SKIPPED_DUPLICATE', 'UNMATCHED', 'MISSING', 'FAILED');

CREATE TABLE "StaffFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "folderName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffFolder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffFolder_name_idx" ON "StaffFolder"("name");

CREATE TABLE "PayslipRun" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "weekOf" DATE NOT NULL,
    "emailedJess" BOOLEAN NOT NULL DEFAULT false,
    "emailError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayslipRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayslipRun_weekOf_idx" ON "PayslipRun"("weekOf");
CREATE INDEX "PayslipRun_messageId_idx" ON "PayslipRun"("messageId");

CREATE TABLE "PayslipLine" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL DEFAULT '',
    "outcome" "PayslipOutcome" NOT NULL,
    "driveFileId" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PayslipLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayslipLine_runId_idx" ON "PayslipLine"("runId");

ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayslipRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
