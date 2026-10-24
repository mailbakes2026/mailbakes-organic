import { handle, requireUser } from "@/lib/api";
import { reschedulePost } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { plannedDate?: unknown } | null;
    const plannedDate = typeof body?.plannedDate === "string" ? body.plannedDate : "";
    const post = await reschedulePost(user, id, plannedDate);
    return Response.json(post);
  });
}
