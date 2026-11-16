import { getSessionUser } from "@/lib/auth";
import { mediaByteResponse } from "@/lib/media-preview";
import { getMedia } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const media = await getMedia(id);
  if (!media) return Response.json({ error: "File not found." }, { status: 404 });
  return mediaByteResponse(new Uint8Array(media.data), media.mimeType, media.fileName, request.headers.get("range"));
}
