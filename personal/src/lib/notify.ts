// Phone notifications. Other MailBakes apps call notify() through
// POST /api/v1/notify; this app calls it for reminders and appointments.
import webpush from "web-push";
import { decryptSecret, encryptionReady, encryptSecret } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import {
  cleanNotice,
  NotifyError,
  parseMuted,
  pushPayload,
  shouldPush,
  type NoticeInput,
  type NotifySource,
} from "@/lib/notify-rules";
import { prisma } from "@/lib/prisma";

export { NotifyError } from "@/lib/notify-rules";

const VAPID_KEY = "vapid";
const MUTED_KEY = "notify_muted";

type Vapid = { publicKey: string; privateKey: string };

/** Push keys are made once and kept in the database (private half encrypted). */
async function vapid(): Promise<Vapid | null> {
  if (!encryptionReady()) return null;
  const saved = await prisma.appSetting.findUnique({ where: { key: VAPID_KEY } });
  if (saved) {
    const parsed = JSON.parse(saved.value) as { publicKey: string; privateKeyEnc: string };
    return { publicKey: parsed.publicKey, privateKey: await decryptSecret(parsed.privateKeyEnc) };
  }
  const keys = webpush.generateVAPIDKeys();
  const value = JSON.stringify({ publicKey: keys.publicKey, privateKeyEnc: await encryptSecret(keys.privateKey) });
  // If two requests race, the first one written wins and both use it.
  await prisma.appSetting.upsert({ where: { key: VAPID_KEY }, create: { key: VAPID_KEY, value }, update: {} });
  return vapid();
}

export async function pushPublicKey() {
  return (await vapid())?.publicKey ?? null;
}

export async function mutedSources() {
  const row = await prisma.appSetting.findUnique({ where: { key: MUTED_KEY } });
  return parseMuted(row?.value);
}

export async function setMuted(input: unknown) {
  const list = parseMuted(JSON.stringify((input as { muted?: unknown } | null)?.muted ?? []));
  const value = JSON.stringify(list);
  await prisma.appSetting.upsert({ where: { key: MUTED_KEY }, create: { key: MUTED_KEY, value }, update: { value } });
  return list;
}

export async function saveDevice(input: unknown, label = "") {
  const sub = (input ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof sub.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub.keys?.auth === "string" ? sub.keys.auth : "";
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) throw new NotifyError("That phone didn't give a proper push address.");
  await prisma.pushDevice.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth, label: label.slice(0, 120) },
    update: { p256dh, auth, failures: 0, label: label.slice(0, 120) },
  });
  return prisma.pushDevice.count();
}

export async function removeDevice(endpoint: string) {
  await prisma.pushDevice.deleteMany({ where: { endpoint } });
}

/** Send one payload to every phone. Phones that have gone away are dropped. */
async function pushAll(payload: string) {
  const keys = await vapid();
  if (!keys) return { sent: 0, failed: 0 };
  const devices = await prisma.pushDevice.findMany();
  let sent = 0;
  let failed = 0;
  await Promise.all(
    devices.map(async (device) => {
      try {
        await webpush.sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, payload, {
          vapidDetails: { subject: "mailto:millie@mailbakes.com", publicKey: keys.publicKey, privateKey: keys.privateKey },
          TTL: 60 * 60 * 12,
          urgency: "normal",
        });
        sent += 1;
        await prisma.pushDevice.update({ where: { id: device.id }, data: { failures: 0, lastOkAt: new Date() } });
      } catch (error) {
        failed += 1;
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410 || device.failures >= 9) {
          await prisma.pushDevice.delete({ where: { id: device.id } }).catch(() => undefined);
        } else {
          await prisma.pushDevice.update({ where: { id: device.id }, data: { failures: { increment: 1 } } }).catch(() => undefined);
          console.error("push", status, error instanceof Error ? error.message : error);
        }
      }
    }),
  );
  return { sent, failed };
}

/** Save a notice and buzz the phone the first time its key is seen. */
export async function notify(notice: NoticeInput) {
  const existing = await prisma.notice.findUnique({ where: { key: notice.key } });
  const row = existing
    ? await prisma.notice.update({ where: { key: notice.key }, data: { title: notice.title, body: notice.body, url: notice.url } })
    : await prisma.notice.create({ data: notice });
  const muted = await mutedSources();
  if (!shouldPush({ source: notice.source, alreadyPushed: Boolean(existing?.pushedAt), muted })) {
    return { id: row.id, pushed: false, sent: 0 };
  }
  const result = await pushAll(pushPayload(row, `${appUrl()}/notifications`));
  if (result.sent > 0) await prisma.notice.update({ where: { id: row.id }, data: { pushedAt: new Date() } });
  return { id: row.id, pushed: result.sent > 0, sent: result.sent };
}

export async function receiveNotice(input: unknown) {
  return notify(cleanNotice(input));
}

export async function sendTest() {
  const result = await pushAll(
    pushPayload({ title: "Notifications are on", body: "This is how MailBakes will tap you on the shoulder.", url: "", key: `test:${Date.now()}` }, `${appUrl()}/notifications`),
  );
  return result;
}

export type NoticeDto = { id: string; source: NotifySource; title: string; body: string; url: string; createdAt: string; pushed: boolean };

export async function recentNotices(limit = 60): Promise<NoticeDto[]> {
  const rows = await prisma.notice.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return rows.map((row) => ({
    id: row.id,
    source: row.source as NotifySource,
    title: row.title,
    body: row.body,
    url: row.url,
    createdAt: row.createdAt.toISOString(),
    pushed: Boolean(row.pushedAt),
  }));
}

export async function deviceCount() {
  return prisma.pushDevice.count();
}

/** Keep the history short: drop notices older than 60 days. */
export async function pruneNotices(now = new Date()) {
  await prisma.notice.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) } } });
}
