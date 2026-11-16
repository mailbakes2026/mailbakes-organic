import { requireSession } from "@/lib/guard";
import { removeMailAccount } from "@/lib/mail-accounts";

export const dynamic = "force-dynamic";

// Disconnects an extra inbox and clears its emails from the board. Nothing in the mailbox itself changes.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await params;
  const removed = await removeMailAccount(id);
  if (!removed) return Response.json({ error: "That inbox was already removed." }, { status: 404 });
  return Response.json({ removed: true });
}
