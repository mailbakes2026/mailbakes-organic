import { handle, requireUser } from "@/lib/api";
import { deletePost, updatePost } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const post = await updatePost(user, id, await request.formData());
    return Response.json(post);
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    await deletePost(user, id);
    return Response.json({ ok: true });
  });
}
