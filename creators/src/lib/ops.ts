export type OpsStatus = "" | "sent" | "failed" | "not_configured";

export type OpsResult = { status: "sent"; error: "" } | { status: "failed" | "not_configured"; error: string };

const ORDER_ID = /^\d{1,32}$/;

/** Digits only, kept as text so a long TikTok order ID is not rounded. */
export function readTiktokOrderId(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw === "number") return { ok: false, error: "TikTok order ID should be text, not a number." };
  if (typeof raw !== "string") return { ok: false, error: "TikTok order ID should be text." };
  const value = raw.trim();
  if (!value) return { ok: true, value: "" };
  if (!ORDER_ID.test(value)) return { ok: false, error: "TikTok order ID should be numbers only." };
  return { ok: true, value };
}

export function needsTiktokMatch(row: { tiktokOrderId: string; tiktokMessage: string }) {
  return row.tiktokOrderId.trim() === "" || row.tiktokMessage.trim() === "";
}

export function opsStatusLabel(status: string, error: string) {
  if (status === "sent") return "Sent to the orders app.";
  if (status === "failed") return error ? `Failed: ${error}` : "Failed.";
  if (status === "not_configured") return "Not configured. Set OPS_APP_URL and OPS_API_TOKEN on the server.";
  return "Not sent yet.";
}

function opsTarget() {
  const url = (process.env.OPS_APP_URL ?? "").trim().replace(/\/$/, "");
  const token = (process.env.OPS_API_TOKEN ?? "").trim();
  if (!url || !token) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { url, token };
}

function messageUrl(base: string) {
  if (base.endsWith("/api/tiktok/message")) return base;
  return `${base}/api/tiktok/message`;
}

function safeReason(text: string) {
  return text.replace(/bearer\s+\S+/gi, "bearer").replace(/\s+/g, " ").trim().slice(0, 180);
}

async function failureReason(response: Response) {
  if (response.status === 401) return "Bad token";
  let text = "";
  try {
    text = await response.text();
  } catch {
    text = "";
  }
  const clean = safeReason(text);
  if (clean.startsWith("{")) {
    try {
      const body = JSON.parse(clean) as { error?: unknown; message?: unknown };
      const message = typeof body.error === "string" ? body.error : typeof body.message === "string" ? body.message : "";
      if (message) return safeReason(message);
    } catch {
      /* The body was not JSON. */
    }
  }
  if (clean && !clean.includes("<")) return clean;
  return `The orders app returned ${response.status}.`;
}

export async function postTiktokMessage(
  tiktokOrderId: string,
  message: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OpsResult> {
  const target = opsTarget();
  if (!target) return { status: "not_configured", error: "Set OPS_APP_URL and OPS_API_TOKEN on the server." };
  let response: Response;
  try {
    response = await fetchImpl(messageUrl(target.url), {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Authorization: `Bearer ${target.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tiktok_order_id: tiktokOrderId, message }),
    });
  } catch {
    return { status: "failed", error: "The orders app didn't respond." };
  }
  if (response.status >= 300 && response.status < 400) {
    return { status: "failed", error: "The orders app redirected the message." };
  }
  if (response.ok) return { status: "sent", error: "" };
  return { status: "failed", error: await failureReason(response) };
}
