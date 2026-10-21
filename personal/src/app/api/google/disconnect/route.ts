import { requireSession } from "@/lib/guard";
import { disconnectGoogle } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  await disconnectGoogle();
  return Response.json({ ok: true });
}
