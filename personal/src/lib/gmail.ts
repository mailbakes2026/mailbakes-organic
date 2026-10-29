import { Prisma } from "@prisma/client";
import { classifyEmail, type EmailGroupName } from "@/lib/classify";
import { financeEmail, supplierDomains } from "@/lib/env";
import { getAccessToken, ReconnectError, SetupError } from "@/lib/google";
import { archiveExtraMessages, refreshExtraInboxes } from "@/lib/mail-accounts";
import { buildForward, toBase64Url } from "@/lib/mime";
import { prisma } from "@/lib/prisma";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const FINANCE_LABEL = "Sent to finance";
const MAX_FORWARD_BYTES = 20 * 1024 * 1024;

type GmailHeader = { name?: string; value?: string };
type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
};

export type StoredAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
};

export class GmailError extends Error {}

// Refresh only reads Gmail. Archive and forward are separate functions, and
// the routes call them only after an explicit button click.

async function gmail(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`${GMAIL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
  if (!response.ok) {
    const message = body.error?.message || `Gmail returned ${response.status}.`;
    if (response.status === 401) throw new ReconnectError("Google needs connecting again.");
    throw new GmailError(message);
  }
  return body as Record<string, unknown>;
}

function header(message: GmailMessage, name: string) {
  const headers = message.payload?.headers ?? [];
  return headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(value: string) {
  const pad = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = pad + "=".repeat((4 - (pad.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function parseFrom(raw: string) {
  const match = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
  return { name: "", email: raw.trim().toLowerCase() };
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function walk(part: GmailPart | undefined, texts: string[], htmls: string[], files: StoredAttachment[]) {
  if (!part) return;
  const filename = part.filename?.trim() ?? "";
  const mime = part.mimeType ?? "";
  if (filename && part.body?.attachmentId) {
    files.push({
      filename,
      mimeType: mime || "application/octet-stream",
      size: part.body.size ?? 0,
      attachmentId: part.body.attachmentId,
    });
  } else if (part.body?.data && mime === "text/plain") {
    texts.push(decodeBase64Url(part.body.data).toString("utf8"));
  } else if (part.body?.data && mime === "text/html") {
    htmls.push(decodeBase64Url(part.body.data).toString("utf8"));
  }
  for (const child of part.parts ?? []) walk(child, texts, htmls, files);
}

function toRow(message: GmailMessage) {
  const from = parseFrom(header(message, "From"));
  const texts: string[] = [];
  const htmls: string[] = [];
  const files: StoredAttachment[] = [];
  walk(message.payload, texts, htmls, files);
  const body = (texts.join("\n\n").trim() || htmlToText(htmls.join("\n"))).slice(0, 8000);
  const subject = header(message, "Subject") || "(No subject)";
  const snippet = message.snippet ?? "";
  const group: EmailGroupName = classifyEmail({
    fromEmail: from.email,
    subject,
    snippet,
    attachmentNames: files.map((file) => file.filename),
    supplierDomains: supplierDomains(),
  });
  const receivedAt = message.internalDate ? new Date(Number(message.internalDate)) : new Date();
  return {
    id: message.id,
    threadId: message.threadId || message.id,
    group,
    fromName: from.name,
    fromEmail: from.email,
    subject: subject.slice(0, 500),
    snippet: snippet.slice(0, 500),
    bodyText: body,
    receivedAt,
    unread: (message.labelIds ?? []).includes("UNREAD"),
    attachments: files as unknown as Prisma.InputJsonValue,
    gmailUrl: `https://mail.google.com/mail/u/0/#inbox/${message.id}`,
    fetchedAt: new Date(),
    accountId: "work",
    remoteId: message.id,
  };
}

async function mapPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current]);
    }
  }
  const count = Math.min(limit, items.length);
  if (count === 0) return;
  await Promise.all(Array.from({ length: count }, () => run()));
}

export async function refreshWorkInbox() {
  const token = await getAccessToken();
  const listed = (await gmail(token, `/messages?q=${encodeURIComponent("in:inbox")}&maxResults=50`)) as {
    messages?: { id: string }[];
    nextPageToken?: string;
  };
  const ids = listed.messages ?? [];
  const seen: string[] = [];
  let failed = 0;
  await mapPool(ids, 5, async (item) => {
    try {
      const message = (await gmail(token, `/messages/${item.id}?format=full`)) as unknown as GmailMessage;
      const row = toRow(message);
      seen.push(row.id);
      await prisma.inboxMessage.upsert({ where: { id: row.id }, create: row, update: row });
    } catch (error) {
      if (error instanceof ReconnectError || error instanceof SetupError) throw error;
      failed += 1;
      console.error(error);
    }
  });
  const listedIds = ids.map((item) => item.id);
  const failedIds = listedIds.filter((id) => !seen.includes(id));
  const kept = failedIds.length
    ? await prisma.inboxMessage.findMany({ where: { id: { in: failedIds }, accountId: "work" }, select: { id: true } })
    : [];
  const keep = [...seen, ...kept.map((row) => row.id)];
  if (listedIds.length > 0 && seen.length === 0 && kept.length === 0) {
    throw new GmailError("None of the inbox emails could be read.");
  }
  if (keep.length === 0) await prisma.inboxMessage.deleteMany({ where: { accountId: "work" } });
  else await prisma.inboxMessage.deleteMany({ where: { accountId: "work", id: { notIn: keep } } });
  return { count: seen.length, failed, truncated: Boolean(listed.nextPageToken) };
}

export type RefreshProblem = { account: string; error: string };

/**
 * Refresh every connected inbox. One inbox failing doesn't stop the others;
 * its problem is reported back. Throws only when nothing at all is connected
 * or the work inbox needs reconnecting and there are no others.
 */
export async function refreshInbox() {
  const problems: RefreshProblem[] = [];
  let count = 0;
  let failed = 0;
  let truncated = false;
  const work = await prisma.googleAccount.findUnique({ where: { id: "default" }, select: { refreshTokenEnc: true, email: true } });
  const extras = await prisma.mailAccount.count();
  if (!work?.refreshTokenEnc && extras === 0) throw new SetupError("Connect Google or add an inbox to use the inbox.");
  if (work?.refreshTokenEnc) {
    try {
      const result = await refreshWorkInbox();
      count += result.count;
      failed += result.failed;
      truncated ||= result.truncated;
    } catch (error) {
      if (extras === 0) throw error;
      problems.push({ account: work.email || "Work", error: error instanceof Error ? error.message : "Couldn't refresh." });
    }
  }
  const extra = await refreshExtraInboxes();
  count += extra.count;
  truncated ||= extra.truncated;
  problems.push(...extra.problems);
  return { count, failed, truncated, problems };
}

export async function archiveMessages(ids: string[]) {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 50);
  if (unique.length === 0) throw new GmailError("Choose at least one email.");
  const known = await prisma.inboxMessage.findMany({
    where: { id: { in: unique } },
    select: { id: true, accountId: true, remoteId: true },
  });
  const byId = new Map(known.map((row) => [row.id, row]));
  const archived: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const workIds: string[] = [];
  const extra: { id: string; accountId: string; remoteId: string }[] = [];
  for (const id of unique) {
    const row = byId.get(id);
    if (!row) failed.push({ id, error: "That email is not on the board. Refresh and try again." });
    else if (row.accountId === "work") workIds.push(id);
    else extra.push(row);
  }
  if (workIds.length) {
    const token = await getAccessToken();
    for (const id of workIds) {
      try {
        await gmail(token, `/messages/${id}/modify`, {
          method: "POST",
          body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
        });
        await prisma.inboxMessage.delete({ where: { id } }).catch(() => undefined);
        archived.push(id);
      } catch (error) {
        if (error instanceof ReconnectError || error instanceof SetupError) throw error;
        failed.push({ id, error: error instanceof Error ? error.message : "Gmail could not archive that email." });
      }
    }
  }
  if (extra.length) {
    const result = await archiveExtraMessages(extra);
    archived.push(...result.archived);
    failed.push(...result.failed);
  }
  return { archived, failed };
}

async function ensureLabel(token: string, name: string) {
  const listed = (await gmail(token, "/labels")) as { labels?: { id: string; name: string }[] };
  const existing = listed.labels?.find((label) => label.name === name);
  if (existing) return existing.id;
  const created = (await gmail(token, "/labels", {
    method: "POST",
    body: JSON.stringify({
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  })) as { id?: string };
  if (!created.id) throw new GmailError("Gmail did not create the Sent to finance label.");
  return created.id;
}

export async function sendInvoiceToFinance(id: string) {
  const saved = await prisma.inboxMessage.findUnique({ where: { id } });
  if (!saved || saved.group !== "INVOICES") {
    throw new GmailError("Send to finance is only for invoice emails.");
  }
  if (saved.accountId !== "work") {
    throw new GmailError("Send to finance works for your work inbox. Forward this one from its own mailbox.");
  }
  const token = await getAccessToken();
  const message = (await gmail(token, `/messages/${id}?format=full`)) as unknown as GmailMessage;
  const texts: string[] = [];
  const htmls: string[] = [];
  const files: StoredAttachment[] = [];
  walk(message.payload, texts, htmls, files);
  const attachments: { filename: string; mimeType: string; data: Buffer }[] = [];
  let total = 0;
  for (const file of files) {
    const got = (await gmail(token, `/messages/${id}/attachments/${encodeURIComponent(file.attachmentId)}`)) as {
      data?: string;
    };
    if (!got.data) continue;
    const data = decodeBase64Url(got.data);
    total += data.length;
    if (total > MAX_FORWARD_BYTES) {
      throw new GmailError("This invoice is over 20MB, so it can't be forwarded from here. Open it in Gmail instead.");
    }
    attachments.push({ filename: file.filename, mimeType: file.mimeType, data });
  }
  const bodyText = (texts.join("\n\n").trim() || htmlToText(htmls.join("\n"))).slice(0, 8000);
  const to = financeEmail();
  const from = saved.fromName ? `${saved.fromName} <${saved.fromEmail}>` : saved.fromEmail;
  const note = [
    `Forwarded to finance (${to}) from Millie's command centre.`,
    "",
    `From: ${from}`,
    `Subject: ${saved.subject}`,
    "",
    attachments.length === 0 ? "This message had no attachments. The text is below." : "The original attachments are included.",
    "",
    bodyText || saved.snippet,
  ].join("\n");
  const account = await prisma.googleAccount.findUnique({ where: { id: "default" } });
  const sender = account?.email || "millie@mailbakes.com";
  const raw = buildForward({
    from: sender,
    to,
    subject: saved.subject.toLowerCase().startsWith("fwd:") ? saved.subject : `Fwd: ${saved.subject}`,
    text: note,
    attachments,
  });
  await gmail(token, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: toBase64Url(Buffer.from(raw)) }),
  });
  let labelled = true;
  try {
    const labelId = await ensureLabel(token, FINANCE_LABEL);
    await gmail(token, `/messages/${id}/modify`, {
      method: "POST",
      body: JSON.stringify({ addLabelIds: [labelId], removeLabelIds: ["INBOX"] }),
    });
    await prisma.inboxMessage.delete({ where: { id } }).catch(() => undefined);
  } catch (error) {
    if (error instanceof ReconnectError || error instanceof SetupError) throw error;
    labelled = false;
    console.error(error);
  }
  return { sentTo: to, labelled };
}
