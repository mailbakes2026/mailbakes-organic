import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function ensureSqliteDir() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) return;
  let file = url.slice("file:".length);
  const query = file.indexOf("?");
  if (query >= 0) file = file.slice(0, query);
  file = decodeURIComponent(file);
  if (!path.isAbsolute(file)) file = path.resolve(process.cwd(), "prisma", file);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  } catch {
    // The Render disk is mounted when the process starts, not while Next builds.
  }
}

ensureSqliteDir();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

let ready: Promise<void> | null = null;

export function prepareDatabase() {
  if (ready) return ready;
  ready = prisma
    .$queryRawUnsafe("PRAGMA journal_mode = WAL;")
    .then(() => prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;"))
    .then(() => undefined)
    .catch((error: unknown) => {
      ready = null;
      throw error;
    });
  return ready;
}
