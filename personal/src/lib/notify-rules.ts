// Pure rules for phone notifications: checking what other apps send in,
// and which sources Millie has muted. No database or network here.

export class NotifyError extends Error {}

export const NOTIFY_SOURCES = [
  "operations",
  "orders",
  "team",
  "organic",
  "finance",
  "conversion",
  "inbox",
  "reminders",
  "appointments",
  "other",
] as const;
export type NotifySource = (typeof NOTIFY_SOURCES)[number];

export const NOTIFY_LABELS: Record<NotifySource, string> = {
  operations: "Operations (Jess's end of day)",
  orders: "Daily Orders",
  team: "Team (sick calls, holidays)",
  organic: "Organic (new posts, changes)",
  finance: "Finance",
  conversion: "Conversion (A/B tests)",
  inbox: "Inbox",
  reminders: "Reminders due",
  appointments: "Appointments",
  other: "Anything else",
};

export type NoticeInput = {
  source: NotifySource;
  key: string;
  title: string;
  body: string;
  url: string;
};

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/**
 * What another app POSTs to /api/v1/notify:
 * { source, title, body?, url?, key? }
 * The same key again updates the notice but doesn't buzz the phone twice.
 */
export function cleanNotice(input: unknown, now = new Date()): NoticeInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new NotifyError("Send a JSON object.");
  const body = input as Record<string, unknown>;
  const source = text(body.source, 40).toLowerCase();
  if (!(NOTIFY_SOURCES as readonly string[]).includes(source)) {
    throw new NotifyError(`source must be one of: ${NOTIFY_SOURCES.join(", ")}.`);
  }
  const title = text(body.title, 120);
  if (!title) throw new NotifyError("Add a title.");
  const message = typeof body.body === "string" ? body.body.trim().slice(0, 600) : "";
  let url = "";
  if (typeof body.url === "string" && body.url.trim()) {
    try {
      const parsed = new URL(body.url.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
      url = parsed.toString();
    } catch {
      throw new NotifyError("url must be a web address.");
    }
  }
  const rawKey = text(body.key, 160);
  if (rawKey && !/^[\w:.@\-/]+$/.test(rawKey)) throw new NotifyError("key can only use letters, numbers and : . - _ / @");
  const key = rawKey ? `${source}:${rawKey}` : `${source}:${now.getTime()}:${Math.random().toString(36).slice(2, 8)}`;
  return { source: source as NotifySource, key, title, body: message, url };
}

export function parseMuted(value: string | null | undefined): NotifySource[] {
  if (!value) return [];
  try {
    const list = JSON.parse(value);
    return Array.isArray(list) ? list.filter((item): item is NotifySource => (NOTIFY_SOURCES as readonly string[]).includes(item)) : [];
  } catch {
    return [];
  }
}

/** Only buzz the first time a key is seen, and never for a muted source. */
export function shouldPush(options: { source: NotifySource; alreadyPushed: boolean; muted: NotifySource[] }) {
  return !options.alreadyPushed && !options.muted.includes(options.source);
}

/** Phones show about two lines, so keep the push itself short. */
export function pushPayload(notice: { title: string; body: string; url: string; key: string }, fallbackUrl: string) {
  const body = notice.body.length > 180 ? `${notice.body.slice(0, 177)}…` : notice.body;
  return JSON.stringify({ title: notice.title, body, url: notice.url || fallbackUrl, tag: notice.key });
}
