export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function readJson(request: Request, max = 20_000) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > max) {
    return { ok: false as const, error: "That request is too large.", status: 413 };
  }
  const text = await request.text();
  if (text.length > max) {
    return { ok: false as const, error: "That request is too large.", status: 413 };
  }
  if (!text.trim()) return { ok: false as const, error: "Send a JSON object.", status: 400 };
  try {
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const, error: "That wasn't valid JSON.", status: 400 };
  }
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
