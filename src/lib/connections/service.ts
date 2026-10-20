import type { Platform, PlatformConnection } from "@prisma/client";
import type { ConnectionStatus } from "@/lib/types";
import { connectionById, connectionBySlug, CONNECTIONS, credentialsReady, missingCredentials } from "@/lib/connections/catalog";
import { decryptSecret, encryptionReady, encryptSecret } from "@/lib/connections/crypto";
import {
  londonDay,
  matchExternalPosts,
  shouldWriteApiStat,
  type ConnectionId,
  type PullResult,
  type TokenSet,
} from "@/lib/connections/model";
import { ProviderError, pullAccount, refreshTokens, tokenDue } from "@/lib/connections/pull";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/service";

const LOCK_ID = "connection-sync-lock";
const LOCK_MS = 15 * 60 * 1000;

function dayDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function metaRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") out[key] = item;
  }
  return out;
}

async function secretFields(tokens: TokenSet) {
  return {
    accessTokenEnc: await encryptSecret(tokens.accessToken),
    refreshTokenEnc: tokens.refreshToken ? await encryptSecret(tokens.refreshToken) : "",
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
    status: "CONNECTED" as const,
    lastSyncError: "",
  };
}

async function readTokens(row: PlatformConnection): Promise<TokenSet> {
  try {
    return {
      accessToken: row.accessTokenEnc ? await decryptSecret(row.accessTokenEnc) : "",
      refreshToken: row.refreshTokenEnc ? await decryptSecret(row.refreshTokenEnc) : "",
      expiresAt: row.expiresAt,
      scopes: row.scopes,
    };
  } catch {
    throw new ProviderError("The saved login can't be read. Connect it again.", true);
  }
}

export async function listConnectionCards() {
  const rows = await prisma.platformConnection.findMany();
  const byPlatform = new Map(rows.map((row) => [row.platform, row]));
  return CONNECTIONS.map((spec) => {
    const row = byPlatform.get(spec.id);
    const missing = missingCredentials(spec);
    const storageReady = encryptionReady();
    const stored = row?.status ?? "DISCONNECTED";
    const status: ConnectionStatus =
      stored === "NEEDS_RECONNECT"
        ? "NEEDS_RECONNECT"
        : stored === "CONNECTED"
          ? "CONNECTED"
          : !storageReady || missing.length > 0
            ? "SETUP_NEEDED"
            : "DISCONNECTED";
    return {
      id: spec.id,
      slug: spec.slug,
      label: spec.label,
      blurb: spec.blurb,
      status,
      accountName: row?.accountName ?? "",
      lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
      lastSyncError: row?.lastSyncError ?? "",
      missing,
      storageReady,
      redirectUri: `${process.env.APP_URL?.replace(/\/$/, "") || "https://mailbakes-organic.onrender.com"}/api/connections/callback/${spec.slug}`,
      setup: spec.setup,
    };
  });
}

export type ConnectionCard = Awaited<ReturnType<typeof listConnectionCards>>[number];

export async function listOrganicReport() {
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  const [posts, followers, days] = await Promise.all([
    prisma.externalPost.findMany({ where: { publishedOn: { gte: since } }, orderBy: { publishedOn: "desc" } }),
    prisma.followerSnapshot.findMany({ where: { day: { gte: since } } }),
    prisma.accountDayStat.findMany({ where: { day: { gte: since } } }),
  ]);
  return {
    posts: posts.map((post) => ({
      platform: post.platform,
      externalId: post.externalId,
      title: post.title,
      publishedOn: dayString(post.publishedOn),
      matchedPostId: post.matchedPostId,
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      saves: post.saves,
      linkClicks: post.linkClicks,
    })),
    followers: followers.map((point) => ({
      platform: point.platform,
      day: dayString(point.day),
      followers: point.followers,
    })),
    days: days.map((day) => ({
      platform: day.platform,
      day: dayString(day.day),
      views: day.views,
      likes: day.likes,
      comments: day.comments,
      shares: day.shares,
      saves: day.saves,
      linkClicks: day.linkClicks,
    })),
  };
}

export type OrganicReport = Awaited<ReturnType<typeof listOrganicReport>>;

async function persistPull(pulled: PullResult) {
  const planner = await prisma.post.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      platforms: true,
      plannedDate: true,
      title: true,
      caption: true,
      stats: { select: { platform: true, source: true } },
    },
  });
  const matched = matchExternalPosts(
    pulled.posts,
    planner.map((post) => ({
      id: post.id,
      platforms: post.platforms,
      plannedDate: dayString(post.plannedDate),
      title: post.title,
      caption: post.caption,
    })),
  );
  const now = new Date();
  for (const post of pulled.posts) {
    const matchedPostId = matched[post.externalId] ?? null;
    const publishedOn = dayDate(post.publishedOn);
    await prisma.externalPost.upsert({
      where: { platform_externalId: { platform: post.platform, externalId: post.externalId } },
      create: {
        platform: post.platform,
        externalId: post.externalId,
        title: post.title,
        caption: post.caption,
        publishedOn,
        permalink: post.permalink,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves,
        linkClicks: post.linkClicks,
        matchedPostId,
        syncedAt: now,
      },
      update: {
        title: post.title,
        caption: post.caption,
        publishedOn,
        permalink: post.permalink,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves,
        linkClicks: post.linkClicks,
        matchedPostId,
        syncedAt: now,
      },
    });
    if (!matchedPostId) continue;
    const existing = planner.find((item) => item.id === matchedPostId)?.stats.find((stat) => stat.platform === post.platform);
    if (!shouldWriteApiStat(existing?.source ?? null)) continue;
    const metrics = {
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      saves: post.saves,
      linkClicks: post.linkClicks,
      source: "API" as const,
      syncedAt: now,
    };
    await prisma.postStat.upsert({
      where: { postId_platform: { postId: matchedPostId, platform: post.platform } },
      create: { postId: matchedPostId, platform: post.platform, ...metrics },
      update: metrics,
    });
  }
  const today = dayDate(londonDay());
  for (const follower of pulled.followers) {
    await prisma.followerSnapshot.upsert({
      where: { platform_day: { platform: follower.platform, day: today } },
      create: { platform: follower.platform, day: today, followers: follower.count },
      update: { followers: follower.count },
    });
  }
  for (const day of pulled.days) {
    const when = dayDate(day.day);
    const metrics = {
      views: day.views,
      likes: day.likes,
      comments: day.comments,
      shares: day.shares,
      saves: day.saves,
      linkClicks: day.linkClicks,
    };
    await prisma.accountDayStat.upsert({
      where: { platform_day: { platform: day.platform, day: when } },
      create: { platform: day.platform, day: when, ...metrics },
      update: metrics,
    });
  }
}

export async function syncConnectionRow(row: PlatformConnection) {
  const spec = connectionById(row.platform);
  if (!spec) throw new ProviderError("Unknown platform.");
  const missing = missingCredentials(spec);
  if (!credentialsReady(spec)) throw new ProviderError(`Add ${missing.join(" and ")} before syncing.`);
  if (!encryptionReady()) throw new ProviderError("TOKEN_ENCRYPTION_KEY or SESSION_SECRET is missing, so the login can't be read.");
  let tokens = await readTokens(row);
  if (!tokens.accessToken) throw new ProviderError("That login is missing. Connect it again.", true);
  if (tokenDue(tokens.expiresAt, spec.id)) {
    tokens = await refreshTokens(spec, tokens);
    await prisma.platformConnection.update({ where: { id: row.id }, data: await secretFields(tokens) });
  }
  const pulled = await pullAccount(spec, tokens.accessToken, metaRecord(row.accountMeta));
  await prisma.platformConnection.update({
    where: { id: row.id },
    data: {
      status: "CONNECTED",
      accountId: pulled.accountId,
      accountName: pulled.accountName,
      accountMeta: pulled.accountMeta,
      lastSyncedAt: new Date(),
      lastSyncError: "",
    },
  });
  await persistPull(pulled);
  return { posts: pulled.posts.length };
}

export async function saveConnection(slug: string, userId: string, tokens: TokenSet) {
  const spec = connectionBySlug(slug);
  if (!spec) throw new HttpError(404, "Unknown platform.");
  if (!encryptionReady()) throw new HttpError(400, "The server can't encrypt tokens yet.");
  const fields = await secretFields(tokens);
  const row = await prisma.platformConnection.upsert({
    where: { platform: spec.id },
    create: { platform: spec.id, ...fields, connectedById: userId },
    update: { ...fields, connectedById: userId },
  });
  try {
    await syncConnectionRow(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    await prisma.platformConnection.update({
      where: { id: row.id },
      data: {
        status: error instanceof ProviderError && error.reconnect ? "NEEDS_RECONNECT" : "CONNECTED",
        lastSyncError: message.slice(0, 500),
      },
    });
  }
}

export async function disconnectConnection(slug: string) {
  const spec = connectionBySlug(slug);
  if (!spec) throw new HttpError(404, "Unknown platform.");
  await prisma.platformConnection.upsert({
    where: { platform: spec.id },
    create: { platform: spec.id, status: "DISCONNECTED" },
    update: {
      status: "DISCONNECTED",
      accessTokenEnc: "",
      refreshTokenEnc: "",
      expiresAt: null,
      accountId: "",
      accountName: "",
      accountMeta: {},
      lastSyncError: "",
    },
  });
}

async function takeLock() {
  const now = Date.now();
  const current = await prisma.appMeta.findUnique({ where: { id: LOCK_ID } });
  if (current && now - Number(current.value) < LOCK_MS) return null;
  await prisma.appMeta.upsert({
    where: { id: LOCK_ID },
    create: { id: LOCK_ID, value: String(now) },
    update: { value: String(now) },
  });
  return String(now);
}

async function releaseLock(stamp: string) {
  await prisma.appMeta.deleteMany({ where: { id: LOCK_ID, value: stamp } });
}

export async function syncConnections(force: boolean) {
  const stamp = await takeLock();
  if (!stamp) return { busy: true as const, results: [] as SyncResult[] };
  try {
    const rows = await prisma.platformConnection.findMany({
      where: { status: { in: ["CONNECTED", "NEEDS_RECONNECT"] }, accessTokenEnc: { not: "" } },
    });
    const today = londonDay();
    const results: SyncResult[] = [];
    for (const row of rows) {
      if (!force && row.status === "CONNECTED" && row.lastSyncedAt && londonDay(row.lastSyncedAt) === today && !row.lastSyncError) {
        continue;
      }
      try {
        const outcome = await syncConnectionRow(row);
        results.push({ platform: row.platform, ok: true, message: `Synced ${outcome.posts} organic posts.`, posts: outcome.posts });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed.";
        await prisma.platformConnection.update({
          where: { id: row.id },
          data: {
            status: error instanceof ProviderError && error.reconnect ? "NEEDS_RECONNECT" : row.status,
            lastSyncError: message.slice(0, 500),
          },
        });
        results.push({ platform: row.platform, ok: false, message, posts: 0 });
      }
    }
    return { busy: false as const, results };
  } finally {
    await releaseLock(stamp);
  }
}

export type SyncResult = { platform: ConnectionId | Platform; ok: boolean; message: string; posts: number };

export function assertManager(role: string) {
  if (role !== "MANAGEMENT") throw new HttpError(403, "Only management can connect accounts.");
}
