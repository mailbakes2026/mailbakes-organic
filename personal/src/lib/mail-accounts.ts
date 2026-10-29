// Extra inboxes beside the work Google login:
//  - a personal Gmail, read over IMAP with a Google app password
//  - Outlook / Hotmail, read with Microsoft Graph after a Microsoft login
// Refresh only reads. Archive runs only when Millie presses Archive.
import { Prisma } from "@prisma/client";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { classifyEmail } from "@/lib/classify";
import { decryptSecret, encryptionReady, encryptSecret } from "@/lib/crypto";
import { microsoftConfigured, microsoftRedirectUri, supplierDomains } from "@/lib/env";
import {
  boardId,
  cleanGmailInput,
  gmailWebLink,
  MailAccountError,
  MICROSOFT_SCOPES,
  parseSender,
  PROVIDER_LABEL,
  type MailProvider,
} from "@/lib/mail-account-rules";
import { prisma } from "@/lib/prisma";

export { MailAccountError } from "@/lib/mail-account-rules";

const MAX_MESSAGES = 50;
const MAX_SOURCE_BYTES = 400_000;

export type MailAccountDto = {
  id: string;
  provider: MailProvider;
  providerLabel: string;
  email: string;
  label: string;
  lastError: string;
  lastSyncedAt: string | null;
};

type AccountRow = Prisma.MailAccountGetPayload<object>;

function dto(row: AccountRow): MailAccountDto {
  const provider = (row.provider === "outlook" ? "outlook" : "gmail") as MailProvider;
  return {
    id: row.id,
    provider,
    providerLabel: PROVIDER_LABEL[provider],
    email: row.email,
    label: row.label,
    lastError: row.lastError,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  };
}

export async function listMailAccounts() {
  const rows = await prisma.mailAccount.findMany({ orderBy: { connectedAt: "asc" } });
  return rows.map(dto);
}

export async function removeMailAccount(id: string) {
  await prisma.inboxMessage.deleteMany({ where: { accountId: id } });
  const result = await prisma.mailAccount.deleteMany({ where: { id } });
  return result.count === 1;
}

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

// ------------------------------------------------------------------ Gmail (IMAP)

function imap(email: string, password: string) {
  return new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
    socketTimeout: 60_000,
  });
}

function imapProblem(error: unknown) {
  const text = messageOf(error, "");
  const response = (error as { responseText?: string; authenticationFailed?: boolean } | null) ?? null;
  if (response?.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|auth/i.test(`${text} ${response?.responseText ?? ""}`)) {
    return "Gmail didn't accept that app password. Make a new one and add the inbox again.";
  }
  return text || "Couldn't reach Gmail.";
}

export async function addGmailAccount(input: unknown) {
  if (!encryptionReady()) throw new MailAccountError("Set TOKEN_ENCRYPTION_KEY or SESSION_SECRET first.");
  const { email, label, appPassword } = cleanGmailInput(input);
  const client = imap(email, appPassword);
  try {
    await client.connect();
    await client.logout();
  } catch (error) {
    throw new MailAccountError(imapProblem(error));
  }
  const secretEnc = await encryptSecret(appPassword);
  const row = await prisma.mailAccount.upsert({
    where: { provider_email: { provider: "gmail", email } },
    create: { provider: "gmail", email, label, secretEnc },
    update: { label, secretEnc, lastError: "" },
  });
  return dto(row);
}

type StoredRow = Prisma.InboxMessageUncheckedCreateInput;

async function readGmail(account: AccountRow) {
  const password = await decryptSecret(account.secretEnc);
  const client = imap(account.email, password);
  const rows: StoredRow[] = [];
  let truncated = false;
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const box = client.mailbox;
      const exists = box ? box.exists : 0;
      const validity = box ? String(box.uidValidity) : "0";
      truncated = exists > MAX_MESSAGES;
      if (exists > 0) {
        const first = Math.max(1, exists - MAX_MESSAGES + 1);
        for await (const message of client.fetch(`${first}:*`, {
          uid: true,
          flags: true,
          envelope: true,
          internalDate: true,
          threadId: true,
          source: { maxLength: MAX_SOURCE_BYTES },
        })) {
          const parsed = message.source ? await simpleParser(message.source).catch(() => null) : null;
          const from = parseSender(
            parsed?.from?.value?.[0]
              ? { name: parsed.from.value[0].name, address: parsed.from.value[0].address }
              : message.envelope?.from?.[0],
          );
          const subject = (parsed?.subject || message.envelope?.subject || "(No subject)").slice(0, 500);
          const text = (parsed?.text || "").replace(/\n{3,}/g, "\n\n").trim();
          const files = (parsed?.attachments ?? [])
            .filter((file) => file.filename)
            .map((file) => ({ filename: file.filename!, mimeType: file.contentType, size: file.size, attachmentId: "" }));
          const remoteId = `${validity}:${message.uid}`;
          const internal = message.internalDate ? new Date(message.internalDate) : null;
          rows.push({
            id: boardId(account.id, remoteId),
            accountId: account.id,
            remoteId,
            threadId: message.threadId || remoteId,
            group: classifyEmail({
              fromEmail: from.email,
              subject,
              snippet: text.slice(0, 300),
              attachmentNames: files.map((file) => file.filename),
              supplierDomains: supplierDomains(),
            }),
            fromName: from.name,
            fromEmail: from.email,
            subject,
            snippet: text.replace(/\s+/g, " ").slice(0, 300),
            bodyText: text.slice(0, 8000),
            receivedAt: internal && !Number.isNaN(internal.getTime()) ? internal : parsed?.date ?? new Date(),
            unread: !(message.flags?.has("\\Seen") ?? false),
            attachments: files as unknown as Prisma.InputJsonValue,
            gmailUrl: gmailWebLink(account.email, message.emailId),
            fetchedAt: new Date(),
          });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
  return { rows, truncated };
}

async function archiveGmail(account: AccountRow, remoteIds: string[]) {
  const password = await decryptSecret(account.secretEnc);
  const client = imap(account.email, password);
  const done: string[] = [];
  await client.connect();
  try {
    const boxes = await client.list();
    const allMail = boxes.find((box) => box.specialUse === "\\All")?.path;
    if (!allMail) throw new MailAccountError("Couldn't find All Mail in that Gmail.");
    const lock = await client.getMailboxLock("INBOX");
    try {
      const validity = client.mailbox ? String(client.mailbox.uidValidity) : "0";
      const uids = remoteIds
        .filter((id) => id.startsWith(`${validity}:`))
        .map((id) => Number(id.split(":")[1]))
        .filter((uid) => Number.isInteger(uid) && uid > 0);
      if (uids.length) {
        // In Gmail, moving out of the inbox into All Mail is the same as Archive.
        await client.messageMove(uids.join(","), allMail, { uid: true });
        done.push(...uids.map((uid) => `${validity}:${uid}`));
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
  return done;
}

// ------------------------------------------------------------- Outlook (Graph)

const GRAPH = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

type TokenBody = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!.trim(),
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!.trim(),
      scope: MICROSOFT_SCOPES.join(" "),
      ...params,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as TokenBody;
  return { ok: response.ok && Boolean(body.access_token), body };
}

export async function saveMicrosoftCode(code: string) {
  if (!microsoftConfigured()) throw new MailAccountError("Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET on Render.");
  if (!encryptionReady()) throw new MailAccountError("Set TOKEN_ENCRYPTION_KEY or SESSION_SECRET first.");
  const { ok, body } = await tokenRequest({
    code,
    redirect_uri: microsoftRedirectUri(),
    grant_type: "authorization_code",
  });
  if (!ok || !body.refresh_token) {
    throw new MailAccountError(body.error_description?.split("\n")[0] || "Microsoft did not accept that login.");
  }
  const me = await fetch(`${GRAPH}/me?$select=mail,userPrincipalName`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${body.access_token}` },
  });
  const profile = (await me.json().catch(() => ({}))) as { mail?: string | null; userPrincipalName?: string };
  const email = (profile.mail || profile.userPrincipalName || "").trim().toLowerCase();
  if (!email) throw new MailAccountError("Microsoft didn't say which mailbox that was. Try again.");
  const data = {
    secretEnc: await encryptSecret(body.refresh_token),
    accessTokenEnc: await encryptSecret(body.access_token!),
    expiresAt: new Date(Date.now() + Number(body.expires_in ?? 3600) * 1000),
    lastError: "",
  };
  const row = await prisma.mailAccount.upsert({
    where: { provider_email: { provider: "outlook", email } },
    create: { provider: "outlook", email, label: "Outlook", ...data },
    update: data,
  });
  return dto(row);
}

async function outlookToken(account: AccountRow) {
  if (account.accessTokenEnc && account.expiresAt && account.expiresAt.getTime() > Date.now() + 60_000) {
    return decryptSecret(account.accessTokenEnc);
  }
  if (!microsoftConfigured()) throw new MailAccountError("Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET on Render.");
  const { ok, body } = await tokenRequest({
    refresh_token: await decryptSecret(account.secretEnc),
    grant_type: "refresh_token",
  });
  if (!ok) {
    throw new MailAccountError(
      body.error === "invalid_grant" ? "Outlook needs connecting again." : body.error_description?.split("\n")[0] || "Outlook login expired.",
    );
  }
  await prisma.mailAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEnc: await encryptSecret(body.access_token!),
      // Microsoft hands out a new refresh token each time. Keep the newest.
      ...(body.refresh_token ? { secretEnc: await encryptSecret(body.refresh_token) } : {}),
      expiresAt: new Date(Date.now() + Number(body.expires_in ?? 3600) * 1000),
    },
  });
  return body.access_token!;
}

async function graph(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`${GRAPH}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.body-content-type="text"',
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (response.status === 401) throw new MailAccountError("Outlook needs connecting again.");
  if (!response.ok) throw new MailAccountError(body.error?.message || `Outlook returned ${response.status}.`);
  return body;
}

type GraphMessage = {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string };
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  isRead?: boolean;
  webLink?: string;
  attachments?: { name?: string; size?: number; contentType?: string }[];
};

async function readOutlook(account: AccountRow) {
  const token = await outlookToken(account);
  const select = "id,conversationId,subject,bodyPreview,body,from,receivedDateTime,isRead,webLink,hasAttachments";
  const listed = (await graph(
    token,
    `/me/mailFolders/inbox/messages?$top=${MAX_MESSAGES}&$orderby=receivedDateTime desc&$select=${select}&$expand=attachments($select=name,size,contentType)`,
  )) as { value?: GraphMessage[]; "@odata.nextLink"?: string };
  const rows: StoredRow[] = (listed.value ?? []).map((message) => {
    const from = parseSender(message.from?.emailAddress);
    const subject = (message.subject || "(No subject)").slice(0, 500);
    const snippet = (message.bodyPreview ?? "").slice(0, 300);
    const files = (message.attachments ?? [])
      .filter((file) => file.name)
      .map((file) => ({ filename: file.name!, mimeType: file.contentType ?? "", size: file.size ?? 0, attachmentId: "" }));
    return {
      id: boardId(account.id, message.id),
      accountId: account.id,
      remoteId: message.id,
      threadId: message.conversationId || message.id,
      group: classifyEmail({
        fromEmail: from.email,
        subject,
        snippet,
        attachmentNames: files.map((file) => file.filename),
        supplierDomains: supplierDomains(),
      }),
      fromName: from.name,
      fromEmail: from.email,
      subject,
      snippet,
      bodyText: (message.body?.content ?? "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 8000),
      receivedAt: message.receivedDateTime ? new Date(message.receivedDateTime) : new Date(),
      unread: message.isRead === false,
      attachments: files as unknown as Prisma.InputJsonValue,
      gmailUrl: message.webLink || "https://outlook.live.com/mail/0/inbox",
      fetchedAt: new Date(),
    };
  });
  return { rows, truncated: Boolean(listed["@odata.nextLink"]) };
}

async function archiveOutlook(account: AccountRow, remoteIds: string[]) {
  const token = await outlookToken(account);
  const done: string[] = [];
  for (const id of remoteIds) {
    await graph(token, `/me/messages/${encodeURIComponent(id)}/move`, {
      method: "POST",
      body: JSON.stringify({ destinationId: "archive" }),
    });
    done.push(id);
  }
  return done;
}

// ------------------------------------------------------------------- shared

async function readAccount(account: AccountRow) {
  return account.provider === "outlook" ? readOutlook(account) : readGmail(account);
}

/** Replace each extra inbox's snapshot. A failing inbox keeps its old snapshot. */
export async function refreshExtraInboxes() {
  const accounts = await prisma.mailAccount.findMany({ orderBy: { connectedAt: "asc" } });
  const problems: { account: string; error: string }[] = [];
  let count = 0;
  let truncated = false;
  for (const account of accounts) {
    try {
      const { rows, truncated: more } = await readAccount(account);
      truncated ||= more;
      count += rows.length;
      await prisma.$transaction([
        prisma.inboxMessage.deleteMany({ where: { accountId: account.id, id: { notIn: rows.map((row) => row.id) } } }),
        ...rows.map((row) => prisma.inboxMessage.upsert({ where: { id: row.id }, create: row, update: row })),
        prisma.mailAccount.update({ where: { id: account.id }, data: { lastError: "", lastSyncedAt: new Date() } }),
      ]);
    } catch (error) {
      const message = account.provider === "gmail" ? imapProblem(error) : messageOf(error, "Couldn't reach Outlook.");
      console.error("inbox refresh", account.provider, message);
      problems.push({ account: account.label || account.email, error: message });
      await prisma.mailAccount.update({ where: { id: account.id }, data: { lastError: message } }).catch(() => undefined);
    }
  }
  return { count, truncated, problems };
}

/** Archive board messages that belong to extra inboxes. */
export async function archiveExtraMessages(items: { id: string; accountId: string; remoteId: string }[]) {
  const archived: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const byAccount = new Map<string, typeof items>();
  for (const item of items) byAccount.set(item.accountId, [...(byAccount.get(item.accountId) ?? []), item]);
  for (const [accountId, group] of byAccount) {
    const account = await prisma.mailAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      for (const item of group) failed.push({ id: item.id, error: "That inbox has been removed. Refresh the page." });
      continue;
    }
    try {
      const remote = group.map((item) => item.remoteId);
      const done = new Set(account.provider === "outlook" ? await archiveOutlook(account, remote) : await archiveGmail(account, remote));
      for (const item of group) {
        if (done.has(item.remoteId)) {
          await prisma.inboxMessage.delete({ where: { id: item.id } }).catch(() => undefined);
          archived.push(item.id);
        } else {
          failed.push({ id: item.id, error: "That email has moved. Refresh and try again." });
        }
      }
    } catch (error) {
      const message = account.provider === "gmail" ? imapProblem(error) : messageOf(error, "Outlook could not archive that email.");
      for (const item of group) failed.push({ id: item.id, error: message });
    }
  }
  return { archived, failed };
}
