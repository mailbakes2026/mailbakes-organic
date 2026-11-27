import { getSessionUser } from "@/lib/auth";
import { retentionToken } from "@/lib/env";
import { bearer, clientIp, json } from "@/lib/http";
import { calendarActorName } from "@/lib/retention/calendar/model";
import { safeEqual } from "@/lib/secret";

const hits = new Map<string, { count: number; reset: number }>();

function limited(ip: string) {
  const now = Date.now();
  const current = hits.get(ip);
  if (current && current.reset > now && current.count >= 60) return true;
  if (!current || current.reset <= now) hits.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
  else current.count += 1;
  return false;
}

export async function authorizeCalendar(request: Request) {
  const user = await getSessionUser();
  if (user) return { ok: true as const, actor: user.name };
  const presented = bearer(request);
  if (!presented) {
    return { ok: false as const, response: json({ error: "Sign in, or send Authorization: Bearer with RETENTION_API_TOKEN." }, 401) };
  }
  const expected = retentionToken();
  if (!expected) return { ok: false as const, response: json({ error: "Setup needed. Set RETENTION_API_TOKEN." }, 503) };
  if (!safeEqual(presented, expected)) return { ok: false as const, response: json({ error: "That API token does not match." }, 401) };
  if (limited(clientIp(request))) {
    return { ok: false as const, response: json({ error: "Too many calendar API requests. Wait a few minutes and try again." }, 429) };
  }
  return { ok: true as const, actor: calendarActorName(request.headers.get("x-mailbakes-actor")) };
}
