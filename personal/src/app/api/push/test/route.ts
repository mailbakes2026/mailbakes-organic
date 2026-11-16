import { requireSession } from "@/lib/guard";
import { sendTest } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  const result = await sendTest();
  if (result.sent === 0) return Response.json({ error: "No phone took the test. Turn notifications on first.", ...result }, { status: 400 });
  return Response.json(result);
}
