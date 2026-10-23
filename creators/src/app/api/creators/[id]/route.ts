import { requireSession } from "@/lib/guard";
import { json, readJson } from "@/lib/http";
import { parsePatch } from "@/lib/parse";
import { deleteCreator, ensureSeeded, getCreator, updateCreator } from "@/lib/records";

export const dynamic = "force-dynamic";

const ID = /^[a-zA-Z0-9_-]{6,40}$/;

async function loadId(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!ID.test(id)) return null;
  return id;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireSession();
  if (denied) return denied;
  const id = await loadId(context);
  if (!id) return json({ error: "That creator isn't on the board." }, 404);
  try {
    await ensureSeeded();
    const creator = await getCreator(id);
    if (!creator) return json({ error: "That creator isn't on the board." }, 404);
    return json({ creator });
  } catch (error) {
    console.error(error);
    return json({ error: "We couldn't reach the database. Try again shortly." }, 503);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireSession();
  if (denied) return denied;
  const id = await loadId(context);
  if (!id) return json({ error: "That creator isn't on the board." }, 404);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status);
  const parsed = parsePatch(body.value);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  try {
    await ensureSeeded();
    const result = await updateCreator(id, parsed.value);
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ creator: result.creator });
  } catch (error) {
    console.error(error);
    return json({ error: "We couldn't reach the database. Try again shortly." }, 503);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireSession();
  if (denied) return denied;
  const id = await loadId(context);
  if (!id) return json({ error: "That creator isn't on the board." }, 404);
  try {
    const removed = await deleteCreator(id);
    if (!removed) return json({ error: "That creator isn't on the board." }, 404);
    return json({ ok: true });
  } catch (error) {
    console.error(error);
    return json({ error: "We couldn't reach the database. Try again shortly." }, 503);
  }
}
