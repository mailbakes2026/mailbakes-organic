import { handle, requireUser } from "@/lib/api";
import { turnNoteIntoPost } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const post = await turnNoteIntoPost(user, id);
    return Response.json(post, { status: 201 });
  });
}
