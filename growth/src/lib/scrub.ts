export function scrub(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer redacted")
    .replace(/access_token=[^&\s]+/gi, "access_token=redacted")
    .replace(/client_secret=[^&\s]+/gi, "client_secret=redacted")
    .replace(/client_id=[^&\s]+/gi, "client_id=redacted")
    .replace(/\bpk_[A-Za-z0-9]+/g, "redacted")
    .replace(/\b(?:shpat|shpss|shpca)_[A-Za-z0-9]+/g, "redacted")
    .replace(/\bEA[A-Za-z0-9]{20,}/g, "redacted")
    .slice(0, 500);
}

export function logSafe(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  console.error(scope, scrub(message));
}
