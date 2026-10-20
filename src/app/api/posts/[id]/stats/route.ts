import { handle, requireUser } from "@/lib/api";
import { updatePostStats } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await context.params;
    const post = await updatePostStats(id, await request.json().catch(() => null));
    return Response.json(post);
  });
}
