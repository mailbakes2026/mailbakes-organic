import bcrypt from "bcryptjs";
import { setSessionCookie, signSession } from "@/lib/auth";
import { bootstrap } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { accountForPassword, SIGN_IN_ERROR, signInCandidates, signInIdentifier } from "@/lib/sign-in";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; reset: number }>();

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = attempts.get(ip);
  if (current && current.reset > now && current.count >= 20) {
    return Response.json(
      { error: "Too many sign-in attempts. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  try {
    await bootstrap();
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "The planner couldn't reach the database. Try again shortly." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { name?: string; email?: string; password?: string } | null;
  const identifier = signInIdentifier(body?.name, body?.email);
  const password = body?.password ?? "";
  const accounts = identifier
    ? await prisma.user.findMany({
        where: {
          OR: [
            { email: identifier.toLowerCase() },
            { name: { equals: identifier, mode: "insensitive" } },
          ],
        },
        select: { id: true, email: true, name: true, role: true, passwordHash: true },
      })
    : [];
  const user = await accountForPassword(password, signInCandidates(identifier, accounts), (plain, hash) =>
    bcrypt.compare(plain, hash),
  );
  if (!user) {
    const next = attempts.get(ip);
    if (!next || next.reset <= now) {
      attempts.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
    } else {
      next.count += 1;
    }
    return Response.json({ error: SIGN_IN_ERROR }, { status: 401 });
  }

  attempts.delete(ip);
  const token = await signSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  await setSessionCookie(token);
  return Response.json({ ok: true, role: user.role, name: user.name });
}
