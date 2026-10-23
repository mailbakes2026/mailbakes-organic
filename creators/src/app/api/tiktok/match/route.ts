import { requireSession } from "@/lib/guard";
import { json } from "@/lib/http";
import { ensureSeeded, matchTiktokOrders } from "@/lib/records";

export const dynamic = "force-dynamic";

export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    await ensureSeeded();
    const report = await matchTiktokOrders();
    return json(report);
  } catch (error) {
    console.error(error);
    return json({ error: "We couldn't reach the database. Try again shortly." }, 503);
  }
}
