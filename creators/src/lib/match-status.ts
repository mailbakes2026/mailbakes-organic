export function matchStatusClass(state: string) {
  if (state === "sent" || state === "matched") return "sent";
  if (state === "failed") return "failed";
  if (state === "not_ready" || state === "not_configured" || state === "unmatched") return "not_configured";
  return "empty";
}
