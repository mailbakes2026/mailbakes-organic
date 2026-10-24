import { handle, requireUser } from "@/lib/api";
import { deleteNote, patchNote, updateNote } from "@/lib/notes";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await context.params;
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const note = await patchNote(id, (await request.json().catch(() => null)) as { checked?: boolean; date?: string | null; title?: string } | null);
      return Response.json(note);
    }
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
