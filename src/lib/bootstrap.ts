import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/types";

type Db = Prisma.TransactionClient;

type AccountSpec = {
  email: string;
  password: string;
  name: string;
  role: Role;
};

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

function accountsFromEnv(): AccountSpec[] {
  const accounts: AccountSpec[] = [];
  const managementEmail = process.env.MANAGEMENT_EMAIL?.trim().toLowerCase();
  const managementPassword = process.env.MANAGEMENT_PASSWORD;
  if (managementEmail && managementPassword) {
    accounts.push({
      email: managementEmail,
      password: managementPassword,
      name: process.env.MANAGEMENT_NAME?.trim() || "Millie",
      role: "MANAGEMENT",
    });
  }
  const teamEmail = process.env.TEAM_EMAIL?.trim().toLowerCase();
  const teamPassword = process.env.TEAM_PASSWORD;
  if (teamEmail && teamPassword) {
    accounts.push({
      email: teamEmail,
      password: teamPassword,
      name: process.env.TEAM_NAME?.trim() || "Content team",
      role: "TEAM",
    });
  }
  if (process.env.EXTRA_USERS) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(process.env.EXTRA_USERS);
    } catch {
      throw new Error("EXTRA_USERS must be JSON.");
    }
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const email = String(record.email ?? "").trim().toLowerCase();
        const password = String(record.password ?? "");
        const role = record.role === "MANAGEMENT" || record.role === "TEAM" ? record.role : null;
        if (!email || !password || !role) continue;
        accounts.push({
          email,
          password,
          name: String(record.name || email),
          role,
        });
      }
    }
  }
  for (const account of accounts) {
    if (account.password.length < 10) {
      throw new Error(`The password for ${account.email} must be at least 10 characters.`);
    }
  }
  return accounts;
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
        await upsertAccounts(db, accountsFromEnv());
        await removeSamples(db);
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
