import { requireSession } from "@/lib/guard";
import { json, readJson } from "@/lib/http";
import { parseInquiry } from "@/lib/parse";
import { createInquiry, ensureSeeded } from "@/lib/records";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status);
  const parsed = parseInquiry(body.value);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  try {
    await ensureSeeded();
    const creator = await createInquiry(parsed.value, "manual");
    return json({ creator }, 201);
  } catch (error) {
    console.error(error);
    return json({ error: "We couldn't reach the database. Try again shortly." }, 503);
  }
}
