import { handle, requireUser } from "@/lib/api";
import { assertManager, syncConnections } from "@/lib/connections/service";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    assertManager(user.role);
    const result = await syncConnections(true);
    if (result.busy) {
      return Response.json({ error: "A sync is already running." }, { status: 409 });
    }
    return Response.json(result);
  });
}
