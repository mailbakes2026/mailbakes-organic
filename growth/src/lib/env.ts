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

function token(name: string) {
  const value = (process.env[name] ?? "").trim();
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
  return names.filter((name) => !(process.env[name] ?? "").trim());
}

export function metaMissing() {
  return missingEnv(["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"]);
}

export function klaviyoMissing() {
  return missingEnv(["KLAVIYO_PRIVATE_API_KEY"]);
}

export function shopifyMissing() {
  return missingEnv(["SHOPIFY_SHOP", "SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"]);
}
