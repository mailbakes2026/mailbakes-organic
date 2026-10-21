export function appUrl() {
  const value = process.env.APP_URL?.trim() || "http://127.0.0.1:3000";
  return value.replace(/\/$/, "");
}

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

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

function emailOr(value: string | undefined, fallback: string) {
  const email = (value || fallback).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fallback;
  return email;
}

export function financeEmail() {
  return emailOr(process.env.FINANCE_EMAIL, "accounts@mailbakes.com");
}

export function paulEmail() {
  return emailOr(process.env.PAUL_EMAIL, "accounts@mailbakes.com");
}

export function jessEmail() {
  return emailOr(process.env.JESS_EMAIL, "operations@mailbakes.com");
}

export function expectedGmail() {
  const value = (process.env.GMAIL_ADDRESS || "millie@mailbakes.com").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "millie@mailbakes.com";
  return value;
}

export function apiToken() {
  const value = (process.env.PERSONAL_API_TOKEN ?? "").trim();
  if (value.length < 16) return null;
  return value;
}

export function supplierDomains() {
  return (process.env.SUPPLIER_DOMAINS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function personalCalendarHints() {
  const raw = process.env.PERSONAL_CALENDAR_NAMES || "personal,home,private,family";
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function googleRedirectUri() {
  return `${appUrl()}/api/google/callback`;
}
