import { json, readJson } from "@/lib/http";
import { calendarAction } from "@/lib/retention/calendar/http";
import { readReview } from "@/lib/retention/calendar/model";
import { addReview } from "@/lib/retention/calendar/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  return calendarAction(request, async (actor) => {
    const { id } = await context.params;
    const body = await readJson(request, 20_000);
    if (!body.ok) return json({ error: body.error }, body.status);
    const parsed = readReview(body.value);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const saved = await addReview(id, {
      author: parsed.data.author || actor,
      body: parsed.data.body,
      verdict: parsed.data.verdict,
      status: parsed.data.status,
    });
    if (!saved) return json({ error: "That campaign was not found." }, 404);
    return json(saved, 201);
  });
}
