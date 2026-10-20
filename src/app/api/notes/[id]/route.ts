import { handle, requireUser } from "@/lib/api";
import { deleteNote, updateNote } from "@/lib/notes";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await context.params;
    const note = await updateNote(id, await request.formData());
    return Response.json(note);
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await context.params;
    await deleteNote(id);
    return Response.json({ ok: true });
  });
}
