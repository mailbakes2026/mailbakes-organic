import { markSvg } from "@/lib/marks";

export function GET() {
  return new Response(markSvg("repeat"), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
