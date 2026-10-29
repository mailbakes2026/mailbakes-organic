-- Extra inboxes (personal Gmail, Outlook) alongside the work Google login.
CREATE TABLE "MailAccount" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "secretEnc" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "lastSyncedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MailAccount_provider_email_key" ON "MailAccount"("provider", "email");

ALTER TABLE "InboxMessage" ADD COLUMN "accountId" TEXT NOT NULL DEFAULT 'work';
ALTER TABLE "InboxMessage" ADD COLUMN "remoteId" TEXT NOT NULL DEFAULT '';
UPDATE "InboxMessage" SET "remoteId" = "id";

CREATE INDEX "InboxMessage_accountId_idx" ON "InboxMessage"("accountId");
