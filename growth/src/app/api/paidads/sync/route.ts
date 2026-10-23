import { getSessionUser } from "@/lib/auth";
import { json } from "@/lib/http";
import { syncMetaLocked } from "@/lib/paidads/sync";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const result = await syncMetaLocked();
  if (!result.ok) return json({ error: result.error }, 502);
  return json({ ok: true, rows: result.rows });
}
