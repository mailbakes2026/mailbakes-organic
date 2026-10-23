import { getSessionUser } from "@/lib/auth";
import { json } from "@/lib/http";
import { syncShopifyLocked } from "@/lib/retention/sync";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const result = await syncShopifyLocked();
  if (!result.ok) return json({ error: result.error }, 502);
  return json({ ok: true });
}
