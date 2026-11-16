import { requireSession } from "@/lib/guard";
import { addGmailAccount, MailAccountError } from "@/lib/mail-accounts";

export const dynamic = "force-dynamic";

// Adds a personal Gmail by app password. Outlook connects through /api/microsoft/start.
export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  try {
    return Response.json(await addGmailAccount(body));
  } catch (error) {
    if (error instanceof MailAccountError) return Response.json({ error: error.message }, { status: 400 });
    console.error(error);
    return Response.json({ error: "That inbox could not be added." }, { status: 502 });
  }
}
