import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { accountsFromEnv, type AccountSpec } from "@/lib/accounts";
import { ensureIgProfile } from "@/lib/ig-profile";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient;

let pending: Promise<void> | null = null;

export function bootstrap() {
  if (!pending) {
    pending = run()
      .then((done) => {
        // Another instance still holds the lock. Forget this attempt so the
        // next request can try again once that connection is gone.
        if (!done) pending = null;
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

function accounts(): AccountSpec[] {
  return accountsFromEnv(process.env);
}

async function upsertAccounts(db: Db, accounts: AccountSpec[]) {
  for (const account of accounts) {
    const existing = await db.user.findUnique({ where: { email: account.email } });
    if (!existing) {
      await db.user.create({
        data: {
          email: account.email,
          name: account.name,
          role: account.role,
          passwordHash: await bcrypt.hash(account.password, 10),
        },
      });
      continue;
    }
    const samePassword = await bcrypt.compare(account.password, existing.passwordHash);
    if (!samePassword || existing.name !== account.name || existing.role !== account.role) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          name: account.name,
          role: account.role,
          passwordHash: samePassword ? undefined : await bcrypt.hash(account.password, 10),
        },
      });
    }
  }
}

// The app used to seed example posts. They were removed on 19 Oct 2026 so the
// social media manager starts from a clean slate. This one-off cleanup removes
// any of those examples still in the database (matched by title and their
// generated SVG artwork, so real posts are never touched). Accounts are left alone.
const SAMPLE_POST_TITLES = [
  "A letterbox birthday",
  "Packed for the post",
  "This morning's bake",
  "Made in Liverpool",
  "The letterbox test",
  "Dispatch day",
  "Christmas Cake Cards",
  "Just because",
  "Win a Cake Card",
];
const SAMPLE_KEY_DATES = ["Christmas Cake Cards launch", "Halloween delivery cut-off"];

async function removeSamples(db: Db) {
  const done = await db.appMeta.findUnique({ where: { id: "samplesRemoved" } });
  if (done) return;
  const seeded = await db.appMeta.findUnique({ where: { id: "sampleSeeded" } });
  if (seeded?.value === "yes") {
    const candidates = await db.post.findMany({
      where: { title: { in: SAMPLE_POST_TITLES } },
      select: { id: true, title: true, media: { select: { fileName: true } } },
    });
    const ids = candidates
      .filter((post) => post.media.length === 1 && post.media[0].fileName === `${post.title}.svg`)
      .map((post) => post.id);
    if (ids.length > 0) await db.post.deleteMany({ where: { id: { in: ids } } });
    await db.keyDate.deleteMany({ where: { title: { in: SAMPLE_KEY_DATES } } });
  }
  await db.appMeta.upsert({
    where: { id: "samplesRemoved" },
    update: {},
    create: { id: "samplesRemoved", value: new Date().toISOString() },
  });
}

// Same rule as the SQL migration: a pending post that already has a changes
// round is waiting in Amendments made, where Millie can approve it again.
async function backfillAmendments(db: Db) {
  await db.$executeRaw`
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
      )
  `;
}

function lockIsBusy(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /lock timeout|lock_timeout|55P03|unable to start a transaction in the given time|expired transaction/i.test(
    message,
  );
}

async function run() {
  // Never wait on a lock held by the instance we are replacing. try_lock
  // returns immediately, the timeouts cap every other wait, and a miss is a
  // skip: account upserts and the sample cleanup are safe to run later.
  try {
    return await prisma.$transaction(
      async (db) => {
        await db.$executeRaw`SELECT set_config('lock_timeout', '2s', true)`;
        await db.$executeRaw`SELECT set_config('statement_timeout', '4s', true)`;
        const rows = await db.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_try_advisory_xact_lock(8142018) AS locked
        `;
        if (!rows[0]?.locked) {
          console.warn("Bootstrap skipped; another instance holds the lock.");
          return false;
        }
        await upsertAccounts(db, accounts());
        await backfillAmendments(db);
        await removeSamples(db);
        await ensureIgProfile(db);
        return true;
      },
      { maxWait: 2_000, timeout: 8_000 },
    );
  } catch (error) {
    if (lockIsBusy(error)) {
      console.warn("Bootstrap skipped; the database lock was busy.");
      return false;
    }
    throw error;
  }
}
