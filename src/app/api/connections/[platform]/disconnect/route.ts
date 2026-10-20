import { handle, requireUser } from "@/lib/api";
import { assertManager, disconnectConnection } from "@/lib/connections/service";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ platform: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    assertManager(user.role);
    const { platform } = await context.params;
    await disconnectConnection(platform);
    return Response.json({ ok: true });
  });
}
