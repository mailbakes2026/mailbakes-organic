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
  const record = body.value && typeof body.value === "object" ? (body.value as { author?: unknown; body?: unknown }) : null;
  const author = typeof record?.author === "string" ? record.author : "";
  const text = typeof record?.body === "string" ? record.body.trim() : "";
  if (!AUTHORS.has(author)) return json({ error: "Author must be Millie or Kyle." }, 400);
  if (!text || text.length > 4000) return json({ error: "Write a note, up to 4000 characters." }, 400);
  try {
    await prepareDatabase();
    await prisma.note.create({ data: { app: "retention", kind: "review", author, body: text } });
    return json({ ok: true }, 201);
  } catch (error) {
    logSafe("review note", error);
    return json({ error: "We couldn't save that note." }, 503);
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status);
  const record = body.value && typeof body.value === "object" ? (body.value as { id?: unknown; confirm?: unknown }) : null;
  if (record?.confirm !== true) return json({ error: "Confirm before removing a note." }, 400);
  const id = typeof record.id === "string" ? record.id : "";
  if (!id) return json({ error: "That note was not found." }, 400);
  try {
    await prepareDatabase();
    const note = await prisma.note.findFirst({ where: { id, app: "retention", kind: "review" } });
    if (!note) return json({ error: "That note was not found." }, 404);
    await prisma.note.delete({ where: { id } });
    return json({ ok: true });
  } catch (error) {
    logSafe("review note delete", error);
    return json({ error: "We couldn't remove that note." }, 503);
  }
}
