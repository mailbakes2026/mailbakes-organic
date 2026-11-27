import { json } from "@/lib/http";
import { safeFilename, sniffDesign } from "@/lib/retention/calendar/files";
import { calendarAction } from "@/lib/retention/calendar/http";
import { addDesign } from "@/lib/retention/calendar/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  return calendarAction(request, async (actor) => {
    const { id } = await context.params;
    const length = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(length) && length > 8_000_000) {
      return json({ error: "Send a PNG, JPG, WebP, or HTML file under 6 MB." }, 413);
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "Attach the design as multipart form data, in the file field." }, 400);
    }
    const file = form.get("file");
    if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
      return json({ error: "Attach the design as the file field." }, 400);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffDesign(bytes);
    if (!sniffed.ok) return json({ error: sniffed.error }, 400);
    const design = await addDesign({
      campaignId: id,
      filename: safeFilename(file.name || "design", sniffed.mime),
      mimeType: sniffed.mime,
      bytes,
      uploadedBy: actor,
    });
    if (!design) return json({ error: "That campaign was not found." }, 404);
    return json({ design }, 201);
  });
}
