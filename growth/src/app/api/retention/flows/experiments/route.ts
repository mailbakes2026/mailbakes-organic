import { getSessionUser } from "@/lib/auth";
import { json, readJson } from "@/lib/http";
import { createExperiment, listExperiments } from "@/lib/retention/experiment-store";
import { experimentJson, readExperiment } from "@/lib/retention/experiments";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  try {
    const rows = await listExperiments();
    return json({ experiments: rows.map(experimentJson) });
  } catch (error) {
    logSafe("flow experiments", error);
    return json({ error: "We couldn't read the tests." }, 503);
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status);
  const parsed = readExperiment(body.value, "create");
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  try {
    const saved = await createExperiment(
      {
        flowId: parsed.data.flowId ?? "",
        flowName: parsed.data.flowName ?? "",
        name: parsed.data.name ?? "",
        hypothesis: parsed.data.hypothesis ?? "",
        variantA: parsed.data.variantA ?? "",
        variantB: parsed.data.variantB ?? "",
        splitA: parsed.data.splitA ?? 50,
        status: parsed.data.status ?? "draft",
        winner: parsed.data.winner ?? "",
        metricName: parsed.data.metricName ?? "",
        metricA: parsed.data.metricA ?? "",
        metricB: parsed.data.metricB ?? "",
        lift: parsed.data.lift ?? "",
        notes: parsed.data.notes ?? "",
      },
      user.name,
    );
    if (!saved.ok) return json({ error: saved.error }, 400);
    return json({ experiment: experimentJson(saved.experiment) }, 201);
  } catch (error) {
    logSafe("flow experiment create", error);
    return json({ error: "We couldn't save that test." }, 503);
  }
}
