/** Per-request cap combined with a pull-wide deadline. A slow call rejects instead of hanging. */
export function mergeSignals(parent: AbortSignal | undefined, ms: number) {
  const local = AbortSignal.timeout(ms);
  if (!parent) return local;
  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) controller.abort();
  };
  if (parent.aborted || local.aborted) {
    abort();
    return controller.signal;
  }
  parent.addEventListener("abort", abort, { once: true });
  local.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

export function isTimeout(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name?: unknown }).name) : "";
  const message = "message" in error ? String((error as { message?: unknown }).message) : "";
  return name === "TimeoutError" || name === "AbortError" || /timed out|took too long|aborted/i.test(message);
}

export const KLAVIYO_TIMEOUT = "Klaviyo took too long. Stored figures were left as they are. Use Refresh to try again.";
export const SHOPIFY_TIMEOUT = "Shopify took too long. Stored orders were left as they are. Use Refresh to try again.";
