import { handle, requireUser } from "@/lib/api";
import { clearHighlightCover, setHighlightCover } from "@/lib/ig-profile";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await context.params;
    return Response.json(await setHighlightCover(id, await request.formData()));
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await context.params;
    return Response.json(await clearHighlightCover(id));
  });
}
