import { json, readJson } from "@/lib/http";
import { calendarAction } from "@/lib/retention/calendar/http";
import { readResults, readSetup } from "@/lib/retention/calendar/model";
import { deleteCampaign, getCampaign, saveManualResults, updateCampaign } from "@/lib/retention/calendar/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function recordOf(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export async function GET(request: Request, context: Ctx) {
  return calendarAction(request, async () => {
    const { id } = await context.params;
    const campaign = await getCampaign(id);
    if (!campaign) return json({ error: "That campaign was not found." }, 404);
    return json({ campaign });
  });
}

export async function PATCH(request: Request, context: Ctx) {
  return calendarAction(request, async () => {
    const { id } = await context.params;
    const body = await readJson(request, 40_000);
    if (!body.ok) return json({ error: body.error }, body.status);
    const record = recordOf(body.value);
    if (!record) return json({ error: "Send a JSON object." }, 400);
    const setupRecord = { ...record };
    delete setupRecord.results;
    const setupKeys = Object.keys(setupRecord);
    let campaign = await getCampaign(id);
    if (!campaign) return json({ error: "That campaign was not found." }, 404);
    if (setupKeys.length) {
      const parsed = readSetup(setupRecord, "patch");
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      campaign = await updateCampaign(id, parsed.data);
    }
    if (Object.prototype.hasOwnProperty.call(record, "results")) {
      const parsed = readResults(record.results);
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      campaign = await saveManualResults(id, parsed.data);
    }
    if (!setupKeys.length && !Object.prototype.hasOwnProperty.call(record, "results")) {
      return json({ error: "Send at least one field to update." }, 400);
    }
    return json({ campaign });
  });
}

export async function DELETE(request: Request, context: Ctx) {
  return calendarAction(request, async () => {
    const { id } = await context.params;
    const removed = await deleteCampaign(id);
    if (!removed) return json({ error: "That campaign was not found." }, 404);
    return json({ ok: true });
  });
}
