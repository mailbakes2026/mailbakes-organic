import { requireApiToken } from "@/lib/guard";
import { clientIp, json, readJson } from "@/lib/http";
import { parseInquiry } from "@/lib/parse";
import { createInquiry, ensureSeeded } from "@/lib/records";

export const dynamic = "force-dynamic";

const hits = new Map<string, { count: number; reset: number }>();

export async function POST(request: Request) {
  const denied = requireApiToken(request);
  if (denied) return denied;

  const ip = clientIp(request);
  const now = Date.now();
  const current = hits.get(ip);
  if (current && current.reset > now && current.count >= 60) {
    return json({ error: "Too many inquiries. Wait a few minutes and try again." }, 429);
  }
  if (!current || current.reset <= now) hits.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
  else current.count += 1;

  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status);
  const parsed = parseInquiry(body.value);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  try {
    await ensureSeeded();
    const creator = await createInquiry(parsed.value, "api");
    return json({ id: creator.id, name: creator.name, stage: creator.stage }, 201);
  } catch (error) {
    console.error(error);
    return json({ error: "We couldn't reach the database. Try again shortly." }, 503);
  }
}
