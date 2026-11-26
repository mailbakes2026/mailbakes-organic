import { json } from "@/lib/http";
import { authorizeCalendar } from "@/lib/retention/calendar/auth";
import { deleteDesign, getDesign } from "@/lib/retention/calendar/store";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const auth = await authorizeCalendar(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await context.params;
    const design = await getDesign(id);
    if (!design) return json({ error: "That design was not found." }, 404);
    const inline = design.mimeType.startsWith("image/");
    const filename = design.filename.replace(/[^\w. -]+/g, "") || "design";
    const bytes = new Uint8Array(design.bytes);
    return new Response(bytes, {
      headers: {
        "Content-Type": design.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(inline ? {} : { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:;" }),
      },
    });
  } catch (error) {
    logSafe("calendar design", error);
    return json({ error: "We couldn't read that design." }, 503);
  }
}

export async function DELETE(request: Request, context: Ctx) {
  const auth = await authorizeCalendar(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await context.params;
    const removed = await deleteDesign(id);
    if (!removed) return json({ error: "That design was not found." }, 404);
    return json({ ok: true });
  } catch (error) {
    logSafe("calendar design", error);
    return json({ error: "We couldn't delete that design." }, 503);
  }
}
