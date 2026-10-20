-- Order for carousels and story frames. Existing rows keep their upload order.
-- File bytes, posts and accounts are not rewritten.
ALTER TABLE "Media" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (PARTITION BY "postId" ORDER BY "createdAt" ASC, id ASC) - 1) AS pos
  FROM "Media"
  WHERE role = 'ATTACHMENT'
)
UPDATE "Media" AS m
SET "position" = ordered.pos
FROM ordered
WHERE m.id = ordered.id;
