-- Notes can be for every platform.
ALTER TABLE "Note" ADD COLUMN "allPlatforms" BOOLEAN NOT NULL DEFAULT false;
