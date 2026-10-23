import { requireSession } from "@/lib/guard";
import { json, readJson } from "@/lib/http";
import { ensureSeeded, saveTiktokOrder } from "@/lib/records";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status);
  const record = body.value && typeof body.value === "object" ? (body.value as Record<string, unknown>) : {};
  try {
    await ensureSeeded();
    const result = await saveTiktokOrder({
      name: record.name,
      message: record.message,
      noMessage: record.noMessage,
      tiktokOrderId: record.tiktokOrderId,
      reference: record.reference,
    });
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ creator: result.creator });
  } catch (error) {
    console.error(error);
    return json({ error: "We couldn't reach the database. Try again shortly." }, 503);
  }
}
