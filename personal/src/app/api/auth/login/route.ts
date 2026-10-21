import { setSessionCookie, signSession } from "@/lib/auth";
import { appName, appPassword, sessionSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { safeEqual } from "@/lib/secret";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; reset: number }>();

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = attempts.get(ip);
  if (current && current.reset > now && current.count >= 20) {
    return Response.json({ error: "Too many sign-in attempts. Wait a few minutes and try again." }, { status: 429 });
  }

  const password = appPassword();
  if (!password || !sessionSecret()) {
    return Response.json(
      { error: "Setup needed. Set APP_PASSWORD and SESSION_SECRET, then restart." },
      { status: 503 },
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error(error);
    return Response.json({ error: "We couldn't reach the database. Try again shortly." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const given = body?.password ?? "";
  if (!safeEqual(given, password)) {
    const next = attempts.get(ip);
    if (!next || next.reset <= now) attempts.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
    else next.count += 1;
    return Response.json({ error: "That password doesn't match. Try again." }, { status: 401 });
  }

  attempts.delete(ip);
  const token = await signSession({ id: "millie", name: appName() });
  await setSessionCookie(token);
  return Response.json({ ok: true, name: appName() });
}
