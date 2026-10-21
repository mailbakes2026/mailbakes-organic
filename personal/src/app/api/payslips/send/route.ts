import { DriveError } from "@/lib/drive";
import { ReconnectError, SetupError } from "@/lib/google";
import { requireSession } from "@/lib/guard";
import { filePayslips } from "@/lib/payslips";
import { ValidationError } from "@/lib/shapes";

export const dynamic = "force-dynamic";

// Filing and the email to Jess run only from this POST, after Send payslips is pressed.

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as {
    messageId?: unknown;
    emailJess?: unknown;
    assignments?: unknown;
  } | null;
  const assignments = Array.isArray(body?.assignments)
    ? body.assignments.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as { attachmentId?: unknown; staffId?: unknown };
        if (typeof record.attachmentId !== "string" || !record.attachmentId) return [];
        const staffId = typeof record.staffId === "string" && record.staffId ? record.staffId : null;
        return [{ attachmentId: record.attachmentId, staffId }];
      })
    : [];
  try {
    const result = await filePayslips({
      messageId: typeof body?.messageId === "string" ? body.messageId : "",
      emailJess: body?.emailJess === true,
      assignments,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof DriveError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SetupError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof ReconnectError) return Response.json({ error: error.message }, { status: 401 });
    console.error(error);
    const message = error instanceof Error ? error.message : "The payslips could not be filed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
