import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { appName, sessionSecret } from "@/lib/env";

const COOKIE = "mb_growth";

export type SessionUser = { id: string; name: string };

function key() {
  const secret = sessionSecret();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export function cookieOptions(maxAge = 60 * 60 * 24 * 14) {
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
    .setExpirationTime("14d")
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
    const name = typeof payload.name === "string" && payload.name.trim() ? payload.name : appName();
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

export { COOKIE };
