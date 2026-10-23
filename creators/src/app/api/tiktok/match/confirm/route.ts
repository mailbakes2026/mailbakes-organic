import { requireSession } from "@/lib/guard";
import { json, readJson } from "@/lib/http";
import { readTiktokOrderId } from "@/lib/ops";
import { confirmTiktokOrder, ensureSeeded } from "@/lib/records";

export const dynamic = "force-dynamic";

const CREATOR_ID = /^[a-zA-Z0-9_-]{6,40}$/;

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status);
  const record = body.value && typeof body.value === "object" ? (body.value as { creatorId?: unknown; tiktokOrderId?: unknown }) : {};
  if (typeof record.creatorId !== "string" || !CREATOR_ID.test(record.creatorId)) {
    return json({ error: "That creator isn't on the board." }, 404);
  }
  const parsed = readTiktokOrderId(record.tiktokOrderId);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  if (!parsed.value) return json({ error: "Enter the TikTok order ID." }, 400);
  try {
    await ensureSeeded();
    const result = await confirmTiktokOrder(record.creatorId, parsed.value);
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ creator: result.creator });
  } catch (error) {
    console.error(error);
    return json({ error: "We couldn't reach the database. Try again shortly." }, 503);
  }
}
