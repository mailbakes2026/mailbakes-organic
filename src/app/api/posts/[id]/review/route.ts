import { handle, requireUser } from "@/lib/api";
import { reviewPost } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { action?: string; comment?: string } | null;
    const post = await reviewPost(user, id, body?.action ?? "", body?.comment ?? "");
    return Response.json(post);
  });
}
