import { json, readJson } from "@/lib/http";
import { calendarAction } from "@/lib/retention/calendar/http";
import { readSetup } from "@/lib/retention/calendar/model";
import { createCampaign } from "@/lib/retention/calendar/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return calendarAction(request, async () => {
    const body = await readJson(request, 40_000);
    if (!body.ok) return json({ error: body.error }, body.status);
    const parsed = readSetup(body.value, "create");
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const campaign = await createCampaign(parsed.data);
    return json({ campaign }, 201);
  });
}
