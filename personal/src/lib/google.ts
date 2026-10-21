import { calendarLane } from "@/lib/classify";
import { encryptSecret, decryptSecret, encryptionReady } from "@/lib/crypto";
import {
  apiToken,
  expectedGmail,
  financeEmail,
  googleConfigured,
  googleRedirectUri,
  personalCalendarHints,
} from "@/lib/env";
import type { GoogleStatus } from "@/lib/google-status";
import { prisma } from "@/lib/prisma";

export type { GoogleStatus } from "@/lib/google-status";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
  // Existing staff folders are chosen by link. drive.file cannot see those folders.
  DRIVE_SCOPE,
];

export function hasDriveScope(scopes: string) {
  return scopes.split(/\s+/).includes(DRIVE_SCOPE);
}

const ACCOUNT_ID = "default";

export class SetupError extends Error {}
export class ReconnectError extends Error {}

export async function googleStatus(): Promise<GoogleStatus> {
  let email = "";
  let connected = false;
  let lastError = "";
  let driveGranted = false;
  try {
    const row = await prisma.googleAccount.findUnique({ where: { id: ACCOUNT_ID } });
    if (row?.refreshTokenEnc) {
      connected = true;
      email = row.email;
      lastError = row.lastError;
      driveGranted = hasDriveScope(row.scopes);
    }
  } catch (error) {
    console.error(error);
    lastError = "We couldn't read the Google connection.";
  }
  return {
    configured: googleConfigured(),
    encryptionReady: encryptionReady(),
    connected,
    email,
    lastError,
    redirectUri: googleRedirectUri(),
    financeEmail: financeEmail(),
    expectedEmail: expectedGmail(),
    apiReady: apiToken() !== null,
    scopes: GOOGLE_SCOPES,
    driveGranted,
  };
}

export function googleAuthUrl(state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID?.trim() ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("login_hint", expectedGmail());
  url.searchParams.set("state", state);
  return url.toString();
}

export async function saveGoogleCode(code: string) {
  if (!googleConfigured()) throw new SetupError("Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  if (!encryptionReady()) throw new SetupError("Set TOKEN_ENCRYPTION_KEY or SESSION_SECRET before connecting Google.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new SetupError(body.error_description || "Google did not accept that connection.");
  }
  const existing = await prisma.googleAccount.findUnique({ where: { id: ACCOUNT_ID } });
  const refresh = body.refresh_token || (existing ? await decryptSecret(existing.refreshTokenEnc) : "");
  if (!refresh) {
    throw new SetupError(
      "Google did not give a refresh token. Remove MailBakes Personal from your Google account permissions, then connect again.",
    );
  }
  const email = await gmailAddress(body.access_token);
  const expiresAt = new Date(Date.now() + Number(body.expires_in ?? 3600) * 1000);
  await prisma.googleAccount.upsert({
    where: { id: ACCOUNT_ID },
    create: {
      id: ACCOUNT_ID,
      email,
      refreshTokenEnc: await encryptSecret(refresh),
      accessTokenEnc: await encryptSecret(body.access_token),
      expiresAt,
      scopes: body.scope || GOOGLE_SCOPES.join(" "),
      lastError: "",
    },
    update: {
      email,
      refreshTokenEnc: await encryptSecret(refresh),
      accessTokenEnc: await encryptSecret(body.access_token),
      expiresAt,
      scopes: body.scope || GOOGLE_SCOPES.join(" "),
      lastError: "",
    },
  });
  return email;
}

async function gmailAddress(accessToken: string) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return "";
  const body = (await response.json().catch(() => ({}))) as { emailAddress?: string };
  return body.emailAddress?.trim().toLowerCase() ?? "";
}

export async function disconnectGoogle() {
  await prisma.inboxMessage.deleteMany();
  await prisma.googleAccount.deleteMany();
}

export async function getAccessToken() {
  const row = await prisma.googleAccount.findUnique({ where: { id: ACCOUNT_ID } });
  if (!row?.refreshTokenEnc) throw new SetupError("Connect Google to use the inbox, calendar and payslips.");
  const fresh = row.expiresAt && row.accessTokenEnc && row.expiresAt.getTime() > Date.now() + 60_000;
  if (fresh) return decryptSecret(row.accessTokenEnc);
  if (!googleConfigured()) throw new SetupError("Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  const refresh = await decryptSecret(row.refreshTokenEnc);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    const message = body.error === "invalid_grant" ? "Google needs connecting again." : body.error_description || "Google did not refresh the login.";
    await prisma.googleAccount.update({ where: { id: ACCOUNT_ID }, data: { lastError: message } });
    throw new ReconnectError(message);
  }
  const expiresAt = new Date(Date.now() + Number(body.expires_in ?? 3600) * 1000);
  await prisma.googleAccount.update({
    where: { id: ACCOUNT_ID },
    data: { accessTokenEnc: await encryptSecret(body.access_token), expiresAt, lastError: "" },
  });
  return body.access_token;
}

export async function connectedEmail() {
  const row = await prisma.googleAccount.findUnique({ where: { id: ACCOUNT_ID } });
  return row?.email ?? "";
}

export function laneForCalendar(name: string) {
  return calendarLane(name, personalCalendarHints());
}
