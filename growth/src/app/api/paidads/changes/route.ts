import { getSessionUser } from "@/lib/auth";
import { londonToday } from "@/lib/dates";
import { json, readJson } from "@/lib/http";
import { toPence } from "@/lib/money";
import { assessMetaChange, CHANGE_AUTHORS } from "@/lib/paidads/changes";
import { prisma, prepareDatabase } from "@/lib/prisma";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status);
  if (!body.value || typeof body.value !== "object") return json({ error: "Send a JSON object." }, 400);
  const record = body.value as Record<string, unknown>;
  if (record.confirm !== true) return json({ error: "Confirm the change before saving." }, 400);
  const level = typeof record.level === "string" ? record.level : "";
  if (level !== "account" && level !== "campaign" && level !== "adset") return json({ error: "Choose account, campaign, or ad set." }, 400);
  const objectName = typeof record.objectName === "string" ? record.objectName.trim().slice(0, 200) : "";
  if (!objectName) return json({ error: "Name the campaign, ad set, or account." }, 400);
  const author = typeof record.author === "string" ? record.author : "";
  if (!CHANGE_AUTHORS.includes(author as (typeof CHANGE_AUTHORS)[number])) return json({ error: "Author must be Millie or Mikey." }, 400);
  const currency = typeof record.currency === "string" ? record.currency.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) return json({ error: "Currency must be a 3-letter code." }, 400);
  const nextPence = toPence(record.next);
  if (nextPence === null) return json({ error: "New budget must be a number." }, 400);
  const previousBlank = record.previous === "" || record.previous === null || record.previous === undefined;
  const previousPence = previousBlank ? null : toPence(record.previous);
  if (!previousBlank && previousPence === null) return json({ error: "Previous budget must be a number, or left blank." }, 400);
  const note = typeof record.note === "string" ? record.note.trim().slice(0, 1000) : "";
  const editId = typeof record.id === "string" && record.id ? record.id : null;
  const today = londonToday();

  try {
    await prepareDatabase();
    const existing = await prisma.budgetChange.findMany({ where: { platform: "meta" }, select: { id: true, day: true } });
    const decision = assessMetaChange(existing, today, editId);
    if (!decision.ok) return json({ error: decision.error }, 409);
    if (decision.mode === "edit" && editId) {
      await prisma.budgetChange.update({
        where: { id: editId },
        data: { level, objectName, previousPence, nextPence, currency, note, author },
      });
    } else {
      await prisma.budgetChange.create({
        data: { platform: "meta", level, objectName, previousPence, nextPence, currency, note, author, day: today },
      });
    }
    return json({ ok: true });
  } catch (error) {
    logSafe("budget change", error);
    return json({ error: "We couldn't write that change." }, 503);
  }
}
