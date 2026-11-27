import { getSessionUser } from "@/lib/auth";
import { json, readJson } from "@/lib/http";
import { deleteExperiment, updateExperiment } from "@/lib/retention/experiment-store";
import { experimentJson, readExperiment } from "@/lib/retention/experiments";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const user = await getSessionUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status);
  const parsed = readExperiment(body.value, "patch");
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  try {
    const { id } = await context.params;
    const saved = await updateExperiment(id, parsed.data, user.name);
    if (!saved.ok) return json({ error: saved.error }, saved.status ?? 400);
    return json({ experiment: experimentJson(saved.experiment) });
  } catch (error) {
    logSafe("flow experiment update", error);
    return json({ error: "We couldn't save that test." }, 503);
  }
}

export async function DELETE(request: Request, context: Ctx) {
  const user = await getSessionUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status);
  const record = body.value && typeof body.value === "object" ? (body.value as { confirm?: unknown }) : null;
  if (record?.confirm !== true) return json({ error: "Confirm before removing a test." }, 400);
  try {
    const { id } = await context.params;
    const removed = await deleteExperiment(id);
    if (!removed) return json({ error: "That test was not found." }, 404);
    return json({ ok: true });
  } catch (error) {
    logSafe("flow experiment delete", error);
    return json({ error: "We couldn't remove that test." }, 503);
  }
}
