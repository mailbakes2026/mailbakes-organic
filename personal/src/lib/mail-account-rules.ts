// Pure rules for extra inboxes, kept free of database and network code so
// they can be unit tested.

export class MailAccountError extends Error {}

export const PROVIDERS = ["gmail", "outlook"] as const;
export type MailProvider = (typeof PROVIDERS)[number];

export const PROVIDER_LABEL: Record<MailProvider, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!EMAIL.test(email)) throw new MailAccountError("Enter the full email address.");
  return email;
}

export function cleanLabel(value: unknown, fallback: string) {
  const label = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (label.length > 30) throw new MailAccountError("Keep the name under 30 characters.");
  return label || fallback;
}

/** Google shows app passwords as four groups of four letters. Spaces are optional. */
export function cleanAppPassword(value: unknown) {
  const password = typeof value === "string" ? value.replace(/\s+/g, "") : "";
  if (!/^[a-zA-Z]{16}$/.test(password)) {
    throw new MailAccountError("Paste the 16-letter app password from Google (not your normal password).");
  }
  return password.toLowerCase();
}

export function cleanGmailInput(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const email = cleanEmail(body.email);
  return {
    email,
    label: cleanLabel(body.label, "Personal"),
    appPassword: cleanAppPassword(body.appPassword),
  };
}

/** Message ids on the board must be unique across every inbox. */
export function boardId(accountId: string, remoteId: string) {
  return `${accountId}:${remoteId}`;
}

/** Opens one message in Gmail on the web, in the right signed-in account. */
export function gmailWebLink(email: string, gmailMessageId: string | undefined) {
  const base = `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}`;
  if (!gmailMessageId || !/^\d+$/.test(gmailMessageId)) return `${base}#inbox`;
  return `${base}#all/${BigInt(gmailMessageId).toString(16)}`;
}

export const MICROSOFT_SCOPES = ["offline_access", "openid", "email", "User.Read", "Mail.ReadWrite"];

export function microsoftAuthUrl(options: { clientId: string; redirectUri: string; state: string }) {
  const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", MICROSOFT_SCOPES.join(" "));
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", options.state);
  return url.toString();
}

/** "Sam Smith <sam@x.com>" or an Outlook { name, address } into name + email. */
export function parseSender(raw: { name?: string; address?: string } | string | undefined) {
  if (!raw) return { name: "", email: "" };
  if (typeof raw !== "string") {
    return { name: (raw.name ?? "").trim(), email: (raw.address ?? "").trim().toLowerCase() };
  }
  const match = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
  return { name: "", email: raw.trim().toLowerCase() };
}
