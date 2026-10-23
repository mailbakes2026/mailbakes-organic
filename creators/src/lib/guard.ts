import { getSessionUser } from "@/lib/auth";
import { apiToken } from "@/lib/env";
import { json } from "@/lib/http";
import { safeEqual } from "@/lib/secret";

export async function requireSession() {
  const user = await getSessionUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  return null;
}

export function requireApiToken(request: Request) {
  const token = apiToken();
  if (!token) {
    return json({ error: "Setup needed. Set CREATORS_API_TOKEN on the server." }, 503);
  }
  const header = request.headers.get("authorization") ?? "";
  const presented = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : "";
  if (!presented || !safeEqual(presented, token)) {
    return json({ error: "That API token does not match." }, 401);
  }
  return null;
}
