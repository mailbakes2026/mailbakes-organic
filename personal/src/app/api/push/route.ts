import { requireSession } from "@/lib/guard";
import { NotifyError, removeDevice, saveDevice } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Turn notifications on for this phone.
export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { subscription?: unknown; label?: unknown } | null;
  try {
    const devices = await saveDevice(body?.subscription, typeof body?.label === "string" ? body.label : "");
    return Response.json({ ok: true, devices });
  } catch (error) {
    if (error instanceof NotifyError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}

// Turn them off for this phone.
export async function DELETE(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint === "string") await removeDevice(body.endpoint);
  return Response.json({ ok: true });
}
