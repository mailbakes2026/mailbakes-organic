import { requireSession } from "@/lib/guard";
import { json } from "@/lib/http";
import { syncSummary } from "@/lib/ops";
import { ensureSeeded, getCreator, syncUnsentTiktokMessages } from "@/lib/records";

export const dynamic = "force-dynamic";

export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    await ensureSeeded();
    const results = await syncUnsentTiktokMessages();
    const creators = [];
    for (const result of results) {
      const creator = await getCreator(result.id);
      if (creator) creators.push(creator);
    }
    return json({ summary: syncSummary(results), results, creators });
  } catch (error) {
    console.error(error);
    return json({ error: "We couldn't reach the database. Try again shortly." }, 503);
  }
}
