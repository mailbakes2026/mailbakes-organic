import { getSessionUser } from "@/lib/auth";
import { getNoteImage } from "@/lib/notes";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const image = await getNoteImage(id);
  if (!image) return Response.json({ error: "File not found." }, { status: 404 });
  const safe = image.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Disposition": `inline; filename="${safe}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
