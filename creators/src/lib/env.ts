export function appName() {
  return process.env.APP_NAME?.trim() || "Millie";
}

export function appPassword() {
  const value = process.env.APP_PASSWORD ?? "";
  if (value.length < 10) return null;
  return value;
}

export function sessionSecret() {
  const value = process.env.SESSION_SECRET ?? "";
  if (value.length < 32) return null;
  return value;
}

export function apiToken() {
  const value = (process.env.CREATORS_API_TOKEN ?? "").trim();
  if (value.length < 16) return null;
  return value;
}
