import { DriveError } from "@/lib/drive";
import { ReconnectError, SetupError } from "@/lib/google";
import { requireSession } from "@/lib/guard";
import { deleteStaff, updateStaff } from "@/lib/payslips";
import { ValidationError } from "@/lib/shapes";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { name?: unknown; folder?: unknown } | null;
  try {
    const staff = await updateStaff(id, String(body?.name ?? ""), String(body?.folder ?? ""));
    if (!staff) return Response.json({ error: "That person isn't on the list." }, { status: 404 });
    return Response.json({ staff });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof DriveError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SetupError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof ReconnectError) return Response.json({ error: error.message }, { status: 401 });
    console.error(error);
    return Response.json({ error: "That folder could not be saved." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await context.params;
  const removed = await deleteStaff(id);
  if (!removed) return Response.json({ error: "That person isn't on the list." }, { status: 404 });
  return Response.json({ ok: true });
}
