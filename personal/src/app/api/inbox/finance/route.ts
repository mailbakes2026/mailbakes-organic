import { GmailError, sendInvoiceToFinance } from "@/lib/gmail";
import { ReconnectError, SetupError } from "@/lib/google";
import { requireSession } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return Response.json({ error: "Choose an invoice email." }, { status: 400 });
  try {
    const result = await sendInvoiceToFinance(id);
    return Response.json(result);
  } catch (error) {
    if (error instanceof GmailError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof SetupError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof ReconnectError) return Response.json({ error: error.message }, { status: 401 });
    console.error(error);
    const message = error instanceof Error ? error.message : "That invoice could not be sent to finance.";
    return Response.json({ error: message }, { status: 502 });
  }
}
