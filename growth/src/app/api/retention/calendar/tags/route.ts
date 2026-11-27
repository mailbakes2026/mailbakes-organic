import { json, readJson } from "@/lib/http";
import { calendarAction } from "@/lib/retention/calendar/http";
import { readTag } from "@/lib/retention/calendar/model";
import { createTag } from "@/lib/retention/calendar/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return calendarAction(request, async () => {
    const body = await readJson(request);
    if (!body.ok) return json({ error: body.error }, body.status);
    const parsed = readTag(body.value);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const saved = await createTag(parsed.data);
    if ("error" in saved) return json({ error: saved.error }, 400);
    return json(saved, 201);
  });
}
