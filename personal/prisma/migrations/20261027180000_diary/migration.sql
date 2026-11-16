-- Diary: daily checklist, notes and debriefs from the other apps. Additive only.
CREATE TABLE "DiaryItem" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),
    "carriedFrom" DATE,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiaryItem_day_idx" ON "DiaryItem"("day");

CREATE INDEX "DiaryItem_doneAt_idx" ON "DiaryItem"("doneAt");

CREATE TABLE "DiaryNote" (
    "day" DATE NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaryNote_pkey" PRIMARY KEY ("day")
);

CREATE TABLE "Debrief" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'daily',
    "title" TEXT NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "link" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debrief_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Debrief_source_kind_day_key" ON "Debrief"("source", "kind", "day");

CREATE INDEX "Debrief_day_idx" ON "Debrief"("day");
