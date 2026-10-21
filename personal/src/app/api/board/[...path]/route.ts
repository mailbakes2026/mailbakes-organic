import { dispatchBoard } from "@/lib/board";
import { requireSession } from "@/lib/guard";

export const dynamic = "force-dynamic";

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const denied = await requireSession();
  if (denied) return denied;
  const { path } = await context.params;
  return dispatchBoard(request.method, request, path);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
