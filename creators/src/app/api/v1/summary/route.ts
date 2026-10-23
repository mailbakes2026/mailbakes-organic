import { requireApiToken } from "@/lib/guard";
import { json } from "@/lib/http";
import { ensureSeeded, listCreators } from "@/lib/records";
import { ceoSummary } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireApiToken(request);
  if (denied) return denied;
  try {
    await ensureSeeded();
    const creators = await listCreators();
    return json(ceoSummary(creators));
  } catch (error) {
    console.error(error);
    return json({ error: "We couldn't reach the database. Try again shortly." }, 503);
  }
}
