export function appName() {
  return envValue("APP_NAME") || "Millie";
}

export function appPassword() {
  const value = envValue("APP_PASSWORD");
  if (value.length < 10) return null;
  return value;
}

export function sessionSecret() {
  const value = envValue("SESSION_SECRET");
  if (value.length < 32) return null;
  return value;
}

export function envValue(name: string) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function token(name: string) {
  const value = envValue(name);
  if (value.length < 16) return null;
  return value;
}

export function paidAdsToken() {
  return token("PAIDADS_API_TOKEN");
}

export function retentionToken() {
  return token("RETENTION_API_TOKEN");
}

export function missingEnv(names: string[]) {
  return names.filter((name) => !envValue(name));
}

export function metaToken() {
  return envValue("META_ACCESS_TOKEN");
}

export function metaAccountId() {
  return envValue("META_AD_ACCOUNT_ID");
}

export function metaMissing() {
  const missing = [];
  if (!metaToken()) missing.push("META_ACCESS_TOKEN");
  if (!metaAccountId()) missing.push("META_AD_ACCOUNT_ID");
  return missing;
}

export function klaviyoMissing() {
  return missingEnv(["KLAVIYO_PRIVATE_API_KEY"]);
}

export function shopifyMissing() {
  return missingEnv(["SHOPIFY_SHOP", "SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"]);
}
