import { InboxBoard, type MailItem } from "@/components/inbox-board";
import type { EmailGroupName } from "@/lib/classify";
import { financeEmail } from "@/lib/env";
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
  const rows = await prisma.inboxMessage.findMany({ orderBy: { receivedAt: "desc" } });
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
      notice={NOTICES[code] ?? null}
    />
  );
}
