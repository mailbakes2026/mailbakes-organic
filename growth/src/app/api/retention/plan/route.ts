import { getSessionUser } from "@/lib/auth";
import { json, readJson } from "@/lib/http";
import { prisma, prepareDatabase } from "@/lib/prisma";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

const AUTHORS = new Set(["Millie", "Kyle"]);

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status);
  const record = body.value && typeof body.value === "object" ? (body.value as Record<string, unknown>) : null;
  if (record?.confirm !== true) return json({ error: "Confirm the decision before saving." }, 400);
  const id = typeof record?.id === "string" ? record.id : "";
  const author = typeof record?.author === "string" ? record.author : "";
  const detail = typeof record?.detail === "string" ? record.detail.trim().slice(0, 2000) : "";
  const decision = typeof record?.decision === "string" ? record.decision.trim().slice(0, 2000) : "";
  if (!id) return json({ error: "That plan line was not found." }, 400);
  if (!AUTHORS.has(author)) return json({ error: "Recorded by must be Kyle or Millie." }, 400);
  try {
    await prepareDatabase();
    const item = await prisma.planItem.findFirst({ where: { id, quarter: "2026-Q4" } });
    if (!item) return json({ error: "That plan line was not found." }, 404);
    await prisma.planItem.update({
      where: { id },
      data: { detail, decision, updatedBy: author, status: decision ? "decided" : "open" },
    });
    return json({ ok: true });
  } catch (error) {
    logSafe("plan", error);
    return json({ error: "We couldn't save that decision." }, 503);
  }
}
