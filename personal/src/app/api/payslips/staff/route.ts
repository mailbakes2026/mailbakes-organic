import { DriveError } from "@/lib/drive";
import { ReconnectError, SetupError } from "@/lib/google";
import { requireSession } from "@/lib/guard";
import { createStaff } from "@/lib/payslips";
import { ValidationError } from "@/lib/shapes";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { name?: unknown; folder?: unknown } | null;
  try {
    const staff = await createStaff(String(body?.name ?? ""), String(body?.folder ?? ""));
    return Response.json({ staff }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof DriveError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SetupError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof ReconnectError) return Response.json({ error: error.message }, { status: 401 });
    console.error(error);
    return Response.json({ error: "That folder could not be saved." }, { status: 500 });
  }
}
