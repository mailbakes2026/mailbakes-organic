-- Personal command centre. Separate database from organic social.
CREATE TYPE "EmailGroup" AS ENUM ('MAILBAKES', 'SUPPLIERS', 'INVOICES', 'PERSONAL');
CREATE TYPE "RunStatus" AS ENUM ('WAITING', 'NEEDS_MILLIE', 'DONE');

CREATE TABLE "GoogleAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "refreshTokenEnc" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT NOT NULL DEFAULT '',
    "lastError" TEXT NOT NULL DEFAULT '',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "group" "EmailGroup" NOT NULL,
    "fromName" TEXT NOT NULL DEFAULT '',
    "fromEmail" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "snippet" TEXT NOT NULL DEFAULT '',
    "bodyText" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "unread" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "gmailUrl" TEXT NOT NULL DEFAULT '',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InboxMessage_group_idx" ON "InboxMessage"("group");
CREATE INDEX "InboxMessage_receivedAt_idx" ON "InboxMessage"("receivedAt");

CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "dueOn" DATE NOT NULL,
    "doneAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Reminder_dueOn_idx" ON "Reminder"("dueOn");

CREATE TABLE "RunItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'WAITING',
    "notes" TEXT NOT NULL DEFAULT '',
    "emailUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RunItem_status_idx" ON "RunItem"("status");

CREATE TABLE "Briefing" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Briefing_date_idx" ON "Briefing"("date");
