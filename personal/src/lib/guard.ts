import { getSessionUser } from "@/lib/auth";
import { apiToken } from "@/lib/env";
import { safeEqual } from "@/lib/secret";

export async function requireSession() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  return null;
}

export function requireApiToken(request: Request) {
  const token = apiToken();
  if (!token) {
    return Response.json({ error: "Setup needed. Set PERSONAL_API_TOKEN on the server." }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const presented = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : "";
  if (!presented || !safeEqual(presented, token)) {
    return Response.json({ error: "That API token does not match." }, { status: 401 });
  }
  return null;
}
