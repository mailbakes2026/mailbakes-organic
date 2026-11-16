import { InboxBoard, type Inbox, type MailItem } from "@/components/inbox-board";
import type { EmailGroupName } from "@/lib/classify";
import { financeEmail, microsoftConfigured } from "@/lib/env";
import { listMailAccounts } from "@/lib/mail-accounts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  connected: "Google is connected. Press Refresh to pull the inbox.",
  cancelled: "Google connection was cancelled.",
  missing: "Google did not return a code. Try connecting again.",
  denied: "Google refused the connection. Check the client id, secret and redirect URL, then try again.",
  norefresh:
    "Google did not give a refresh token. Remove MailBakes Personal from your Google account permissions, then connect again.",
};

const OUTLOOK_NOTICES: Record<string, string> = {
  connected: "Outlook is connected. Press Refresh to pull it in.",
  cancelled: "Outlook connection was cancelled.",
  missing: "Microsoft did not return a code. Try connecting again.",
  denied: "Microsoft refused the connection. Check MICROSOFT_CLIENT_ID, the secret and the redirect URL, then try again.",
  setup: "Outlook isn't set up yet. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET on Render first.",
};

function attachmentsOf(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.filename !== "string") return [];
    return [{ filename: record.filename, size: typeof record.size === "number" ? record.size : 0 }];
  });
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const code = typeof params.google === "string" ? params.google : "";
  const outlook = typeof params.outlook === "string" ? params.outlook : "";
  const [rows, extras, work] = await Promise.all([
    prisma.inboxMessage.findMany({ orderBy: { receivedAt: "desc" } }),
    listMailAccounts(),
    prisma.googleAccount.findUnique({ where: { id: "default" }, select: { email: true, refreshTokenEnc: true } }),
  ]);
  const inboxes: Inbox[] = [
    ...(work?.refreshTokenEnc
      ? [{ id: "work", label: "Work", email: work.email, provider: "gmail" as const, providerLabel: "Gmail", lastError: "", removable: false }]
      : []),
    ...extras.map((account) => ({ ...account, removable: true })),
  ];
  const messages: MailItem[] = rows.map((row) => ({
    id: row.id,
    group: row.group as EmailGroupName,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    subject: row.subject,
    snippet: row.snippet,
    bodyText: row.bodyText,
    receivedAt: row.receivedAt.toISOString(),
    unread: row.unread,
    attachments: attachmentsOf(row.attachments),
    gmailUrl: row.gmailUrl,
    accountId: row.accountId,
  }));
  const refreshedAt = rows.reduce<string | null>((latest, row) => {
    const iso = row.fetchedAt.toISOString();
    return !latest || iso > latest ? iso : latest;
  }, null);

  return (
    <InboxBoard
      messages={messages}
      refreshedAt={refreshedAt}
      financeEmail={financeEmail()}
      notice={NOTICES[code] ?? OUTLOOK_NOTICES[outlook] ?? null}
      inboxes={inboxes}
      outlookReady={microsoftConfigured()}
    />
  );
}
