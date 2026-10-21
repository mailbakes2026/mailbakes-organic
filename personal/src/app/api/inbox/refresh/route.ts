import { refreshInbox } from "@/lib/gmail";
import { ReconnectError, SetupError } from "@/lib/google";
import { requireSession } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    const result = await refreshInbox();
    return Response.json(result);
  } catch (error) {
    if (error instanceof SetupError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof ReconnectError) return Response.json({ error: error.message }, { status: 401 });
    console.error(error);
    const message = error instanceof Error ? error.message : "The inbox could not be refreshed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
