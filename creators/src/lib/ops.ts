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

/** Save posts when an order ID and message are present and this sample is not already marked sent. */
export function shouldSendTiktokMessage(input: {
  tiktokOrderId: string;
  tiktokMessage: string;
  previousId: string;
  previousMessage: string;
  opsStatus: string;
  explicit: boolean;
}) {
  if (input.explicit) return true;
  if (!input.tiktokOrderId.trim() || !input.tiktokMessage.trim()) return false;
  if (input.tiktokOrderId !== input.previousId || input.tiktokMessage !== input.previousMessage) return true;
  return input.opsStatus !== "sent";
}

export type RemoteState = "has_message" | "different" | "missing" | "no_parcel" | "unavailable" | "not_configured" | "failed";

export type RemoteCheck = { state: RemoteState; label: string };

const NO_READ = "The orders app has no read endpoint for TikTok messages.";

export function remoteStatusClass(state: string) {
  if (state === "has_message") return "sent";
  if (state === "failed" || state === "different") return "failed";
  if (state === "missing" || state === "no_parcel" || state === "not_configured") return "not_configured";
  return "empty";
}

/** Interpret a GET of the orders app. A session-only 401 means there is nothing to read with the bearer token. */
export function interpretTiktokRead(status: number, body: string, localMessage: string): RemoteCheck {
  const clean = safeReason(body);
  if (status === 401) {
    if (/not signed in/i.test(clean)) return { state: "unavailable", label: NO_READ };
    return { state: "failed", label: "Could not check the orders app: Bad token" };
  }
  if (status === 404 || status === 405) return { state: "unavailable", label: NO_READ };
  if (status >= 300 && status < 400) {
    return { state: "failed", label: "Could not check the orders app: The orders app redirected the check." };
  }
  if (status < 200 || status >= 300) {
    return { state: "failed", label: `Could not check the orders app: The orders app returned ${status}.` };
  }
  if (!clean.startsWith("{") || clean.includes("<")) return { state: "unavailable", label: NO_READ };
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { state: "unavailable", label: NO_READ };
  }
  if (!parsed || typeof parsed !== "object") return { state: "unavailable", label: NO_READ };
  const record = parsed as { found?: unknown; message?: unknown };
  if (!("message" in record) && !("found" in record)) return { state: "unavailable", label: NO_READ };
  if (record.found === false) return { state: "no_parcel", label: "The orders app has no parcel with this TikTok order ID." };
  const message = typeof record.message === "string" ? record.message.trim() : "";
  if (!message) return { state: "missing", label: "The orders app is still waiting for this message." };
  if (localMessage.trim() && message !== localMessage.trim()) {
    return { state: "different", label: "The orders app has a different message." };
  }
  return { state: "has_message", label: "The orders app has this message." };
}

export function syncSummary(results: { name: string; status: string; error: string }[]) {
  if (results.length === 0) return "Nothing waiting to send.";
  const parts: string[] = [];
  const sent = results.filter((row) => row.status === "sent");
  const failed = results.filter((row) => row.status === "failed");
  const bare = results.filter((row) => row.status === "not_configured");
  if (sent.length) parts.push(`Sent ${sent.map((row) => row.name).join(", ")}.`);
  if (failed.length) parts.push(`Failed ${failed.map((row) => `${row.name}: ${row.error || "failed"}`).join("; ")}.`);
  if (bare.length) parts.push(`Not configured for ${bare.map((row) => row.name).join(", ")}.`);
  return parts.join(" ");
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

function originUrl(base: string) {
  const suffix = "/api/tiktok/message";
  if (base.endsWith(suffix)) return base.slice(0, -suffix.length);
  return base;
}

export async function opsGet(path: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: false; reason: "not_configured" } | { ok: false; reason: "network" } | { ok: true; status: number; body: string }> {
  const target = opsTarget();
  if (!target) return { ok: false, reason: "not_configured" };
  const url = new URL(path, `${originUrl(target.url)}/`);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${target.token}`, Accept: "application/json" },
    });
  } catch {
    return { ok: false, reason: "network" };
  }
  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "";
  }
  return { ok: true, status: response.status, body };
}

function messageUrl(base: string) {
  if (base.endsWith("/api/tiktok/message")) return base;
  return `${base}/api/tiktok/message`;
}

function readUrl(base: string, tiktokOrderId: string) {
  const url = new URL(messageUrl(base));
  url.searchParams.set("tiktok_order_id", tiktokOrderId);
  return url.toString();
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
  reference = "",
): Promise<OpsResult> {
  const target = opsTarget();
  if (!target) return { status: "not_configured", error: "Set OPS_APP_URL and OPS_API_TOKEN on the server." };
  const payload: { message: string; tiktok_order_id?: string; reference?: string } = { message };
  if (tiktokOrderId) payload.tiktok_order_id = tiktokOrderId;
  if (reference) payload.reference = reference;
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
      body: JSON.stringify(payload),
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

export async function readTiktokMessage(
  tiktokOrderId: string,
  localMessage: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RemoteCheck> {
  const target = opsTarget();
  if (!target) return { state: "not_configured", label: opsStatusLabel("not_configured", "") };
  let response: Response;
  try {
    response = await fetchImpl(readUrl(target.url, tiktokOrderId), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${target.token}`, Accept: "application/json" },
    });
  } catch {
    return { state: "failed", label: "Could not check the orders app: The orders app didn't respond." };
  }
  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "";
  }
  return interpretTiktokRead(response.status, body, localMessage);
}
