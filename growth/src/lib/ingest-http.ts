import { appFromHost, type AppId } from "@/lib/host";
import { paidAdsToken, retentionToken } from "@/lib/env";
import { bearer, clientIp, json, readJson } from "@/lib/http";
import { upsertAdRows } from "@/lib/paidads/store";
import { parsePaidIngest } from "@/lib/paidads/ingest";
import { parseRetentionIngest } from "@/lib/retention/ingest";
import { replaceOrders, replaceSends, upsertLists } from "@/lib/retention/store";
import { logSafe } from "@/lib/scrub";
import { safeEqual } from "@/lib/secret";

const hits = new Map<string, { count: number; reset: number }>();

function limited(ip: string, app: string) {
  const key = `${app}:${ip}`;
  const now = Date.now();
  const current = hits.get(key);
  if (current && current.reset > now && current.count >= 30) return true;
  if (!current || current.reset <= now) hits.set(key, { count: 1, reset: now + 10 * 60 * 1000 });
  else current.count += 1;
  return false;
}

export async function handleIngest(request: Request, forced: AppId | null) {
  const paid = paidAdsToken();
  const retention = retentionToken();
  if (paid && retention && safeEqual(paid, retention)) {
    return json({ error: "Setup needed. PAIDADS_API_TOKEN and RETENTION_API_TOKEN must be different." }, 503);
  }

  const hostApp = appFromHost(request.headers.get("x-forwarded-host") || request.headers.get("host"));
  const presented = bearer(request);
  if (!presented) return json({ error: "Send Authorization: Bearer and the API token." }, 401);

  let target: AppId | null = forced ?? hostApp;
  if (!target) {
    if (paid && safeEqual(presented, paid)) target = "paidads";
    else if (retention && safeEqual(presented, retention)) target = "retention";
    else if (!paid && !retention) {
      return json({ error: "Setup needed. Set PAIDADS_API_TOKEN or RETENTION_API_TOKEN." }, 503);
    } else return json({ error: "That API token does not match." }, 401);
  }

  const expected = target === "paidads" ? paid : retention;
  const name = target === "paidads" ? "PAIDADS_API_TOKEN" : "RETENTION_API_TOKEN";
  if (!expected) return json({ error: `Setup needed. Set ${name}.` }, 503);
  if (!safeEqual(presented, expected)) return json({ error: "That API token does not match." }, 401);
  if (limited(clientIp(request), target)) return json({ error: "Too many ingest requests. Wait a few minutes and try again." }, 429);

  const body = await readJson(request, 1_500_000);
  if (!body.ok) return json({ error: body.error }, body.status);

  try {
    if (target === "paidads") {
      const parsed = parsePaidIngest(body.value);
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      await upsertAdRows(parsed.rows);
      return json({ ok: true, app: "paidads", upserted: parsed.rows.length }, 201);
    }
    const parsed = parseRetentionIngest(body.value);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    if (parsed.value.flows.length) await replaceSends("flow", "ingest", parsed.value.flows);
    if (parsed.value.campaigns.length) await replaceSends("campaign", "ingest", parsed.value.campaigns);
    if (parsed.value.lists.length) await upsertLists(parsed.value.lists);
    if (parsed.value.orders.length) await replaceOrders("ingest", parsed.value.orders, parsed.value.replaceOrders);
    return json(
      {
        ok: true,
        app: "retention",
        flows: parsed.value.flows.length,
        campaigns: parsed.value.campaigns.length,
        lists: parsed.value.lists.length,
        orders: parsed.value.orders.length,
      },
      201,
    );
  } catch (error) {
    logSafe("ingest", error);
    return json({ error: "We couldn't write those rows. Try again shortly." }, 503);
  }
}
