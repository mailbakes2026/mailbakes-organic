-- Ideas and inspo. Existing posts and accounts are not rewritten.
CREATE TYPE "NoteStatus" AS ENUM ('IDEA', 'PLANNED', 'DONE');

CREATE TABLE "Note" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "platform" "Platform",
  "date" DATE,
  "doThisWeek" BOOLEAN NOT NULL DEFAULT false,
  "status" "NoteStatus" NOT NULL DEFAULT 'IDEA',
  "authorId" TEXT NOT NULL,
  "postId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NoteImage" (
  "id" TEXT NOT NULL,
  "noteId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NoteImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Note_postId_key" ON "Note"("postId");
CREATE INDEX "Note_date_idx" ON "Note"("date");
CREATE INDEX "Note_authorId_idx" ON "Note"("authorId");
CREATE INDEX "NoteImage_noteId_idx" ON "NoteImage"("noteId");

ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NoteImage" ADD CONSTRAINT "NoteImage_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
