import { json } from "@/lib/http";
import { calendarAction } from "@/lib/retention/calendar/http";
import { deleteTag } from "@/lib/retention/calendar/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Ctx) {
  return calendarAction(request, async () => {
    const { id } = await context.params;
    const removed = await deleteTag(id);
    if (!removed) return json({ error: "That tag was not found." }, 404);
    return json({ ok: true });
  });
}
