import { archiveMessages, GmailError } from "@/lib/gmail";
import { ReconnectError, SetupError } from "@/lib/google";
import { requireSession } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
  try {
    const result = await archiveMessages(ids);
    if (result.archived.length === 0) {
      return Response.json({ error: result.failed[0]?.error || "Nothing was archived.", ...result }, { status: 400 });
    }
    return Response.json(result);
  } catch (error) {
    if (error instanceof GmailError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof SetupError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof ReconnectError) return Response.json({ error: error.message }, { status: 401 });
    console.error(error);
    const message = error instanceof Error ? error.message : "Those emails could not be archived.";
    return Response.json({ error: message }, { status: 502 });
  }
}
