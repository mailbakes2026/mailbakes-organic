import { requireSession } from "@/lib/guard";
import { setMuted } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  return Response.json({ muted: await setMuted(await request.json().catch(() => null)) });
}
