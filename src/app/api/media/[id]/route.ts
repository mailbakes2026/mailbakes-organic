import { getSessionUser } from "@/lib/auth";
import { getMedia } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const media = await getMedia(id);
  if (!media) return Response.json({ error: "File not found." }, { status: 404 });
  const safe = media.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new Response(new Uint8Array(media.data), {
    headers: {
      "Content-Type": media.mimeType,
      "Content-Disposition": `inline; filename="${safe}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
