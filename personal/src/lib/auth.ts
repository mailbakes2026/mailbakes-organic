import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { appName, sessionSecret } from "@/lib/env";
import { sessionDisplayName } from "@/lib/sign-in";

const COOKIE = "mb_personal";

export type SessionUser = { id: string; name: string };

function key() {
  const secret = sessionSecret();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

/**
 * Millie stays signed in on her own devices, including the home-screen app:
 * the session lasts a year and is renewed each day she uses the app (see
 * middleware.ts), so it only runs out after a year without opening it.
 * Signing out, or changing SESSION_SECRET, still ends every session.
 */
export const SESSION_DAYS = 365;

export function cookieOptions(maxAge = 60 * 60 * 24 * SESSION_DAYS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function signSession(user: SessionUser) {
  const secret = key();
  if (!secret) throw new Error("Set SESSION_SECRET to at least 32 characters.");
  return new SignJWT({ name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const secret = key();
  if (!secret) return null;
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const id = String(payload.sub ?? "");
    if (!id) return null;
    const name = sessionDisplayName(payload.name, appName());
    return { id, name };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, cookieOptions());
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function signGoogleState() {
  const secret = key();
  if (!secret) throw new Error("Set SESSION_SECRET to at least 32 characters.");
  return new SignJWT({ purpose: "google-connect" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

export async function verifyGoogleState(token: string) {
  const secret = key();
  if (!secret) return false;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.purpose === "google-connect";
  } catch {
    return false;
  }
}

export { COOKIE };

/** Short-lived signed state for the Microsoft (Outlook) login. */
export async function signMicrosoftState() {
  const secret = key();
  if (!secret) throw new Error("Set SESSION_SECRET to at least 32 characters.");
  return new SignJWT({ purpose: "microsoft-connect" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

export async function verifyMicrosoftState(token: string) {
  const secret = key();
  if (!secret) return false;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.purpose === "microsoft-connect";
  } catch {
    return false;
  }
}
