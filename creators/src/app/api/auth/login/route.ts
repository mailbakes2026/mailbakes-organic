import { setSessionCookie, signSession } from "@/lib/auth";
import { appName, appPassword, sessionSecret } from "@/lib/env";
import { json, readJson, clientIp } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { safeEqual } from "@/lib/secret";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; reset: number }>();

export async function POST(request: Request) {
  const ip = clientIp(request);
  const now = Date.now();
  const current = attempts.get(ip);
  if (current && current.reset > now && current.count >= 20) {
    return json({ error: "Too many sign-in attempts. Wait a few minutes and try again." }, 429);
  }

  const password = appPassword();
  if (!password || !sessionSecret()) {
    return json({ error: "Setup needed. Set APP_PASSWORD and SESSION_SECRET, then restart." }, 503);
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error(error);
    return json({ error: "We couldn't reach the database. Try again shortly." }, 503);
  }

  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status);
  const record = body.value && typeof body.value === "object" ? (body.value as { password?: unknown }) : null;
  const given = typeof record?.password === "string" ? record.password : "";
  if (!safeEqual(given, password)) {
    const next = attempts.get(ip);
    if (!next || next.reset <= now) attempts.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
    else next.count += 1;
    return json({ error: "That password doesn't match. Try again." }, 401);
  }

  attempts.delete(ip);
  const token = await signSession({ id: "millie", name: appName() });
  await setSessionCookie(token);
  return json({ ok: true, name: appName() });
}
