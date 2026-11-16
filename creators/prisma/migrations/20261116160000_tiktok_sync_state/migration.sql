CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);
