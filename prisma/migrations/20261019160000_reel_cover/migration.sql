-- CreateEnum
CREATE TYPE "MediaRole" AS ENUM ('ATTACHMENT', 'REEL_COVER');

-- AlterTable
-- Existing files stay attachments. The default fills the new column without
-- rewriting post or account rows.
ALTER TABLE "Media" ADD COLUMN "role" "MediaRole" NOT NULL DEFAULT 'ATTACHMENT';
