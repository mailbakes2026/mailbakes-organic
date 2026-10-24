ALTER TABLE "Comment" ADD COLUMN "authorName" TEXT NOT NULL DEFAULT '';

UPDATE "Comment" AS c
SET "authorName" = u.name
FROM "User" AS u
WHERE c."authorId" = u.id
  AND c."authorName" = '';

ALTER TABLE "Note" ADD COLUMN "checked" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Note" SET "checked" = true WHERE status = 'DONE';

-- Posts sent back after "Changes requested" belong in Amendments made,
-- so the approver can act on them again.
UPDATE "Post" AS p
SET status = 'AMENDMENTS_MADE'
WHERE p.status = 'PENDING_APPROVAL'
  AND EXISTS (
    SELECT 1
    FROM "Comment" AS c
    WHERE c."postId" = p.id
      AND (
        c.kind = 'CHANGES'
        OR c.body = 'Sent back for approval.'
      )
  );
