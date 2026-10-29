import { handle, requireUser } from "@/lib/api";
import { deleteKeyDate, updateKeyDate } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await context.params;
    return Response.json(await updateKeyDate(id, await request.formData()));
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await context.params;
    await deleteKeyDate(id);
    return Response.json({ ok: true });
  });
}
