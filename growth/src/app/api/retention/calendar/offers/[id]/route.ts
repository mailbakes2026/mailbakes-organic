import { json, readJson } from "@/lib/http";
import { calendarAction } from "@/lib/retention/calendar/http";
import { readOffer } from "@/lib/retention/calendar/model";
import { deleteOffer, updateOffer } from "@/lib/retention/calendar/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  return calendarAction(request, async () => {
    const { id } = await context.params;
    const body = await readJson(request);
    if (!body.ok) return json({ error: body.error }, body.status);
    const parsed = readOffer(body.value, "patch");
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const saved = await updateOffer(id, parsed.data);
    if (!saved) return json({ error: "That offer was not found." }, 404);
    if ("error" in saved) return json({ error: saved.error }, 400);
    return json(saved);
  });
}

export async function DELETE(request: Request, context: Ctx) {
  return calendarAction(request, async () => {
    const { id } = await context.params;
    const removed = await deleteOffer(id);
    if (!removed) return json({ error: "That offer was not found." }, 404);
    return json({ ok: true });
  });
}
