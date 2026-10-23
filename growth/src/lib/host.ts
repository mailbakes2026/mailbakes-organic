export const PAID_HOST = "paidads.mailbakes.com";
export const RETENTION_HOST = "retention.mailbakes.com";

export type AppId = "paidads" | "retention";

export function hostName(host: string | null | undefined) {
  return (host ?? "").split(",")[0]?.trim().split(":")[0]?.trim().toLowerCase() ?? "";
}

export function appFromHost(host: string | null | undefined): AppId | null {
  const name = hostName(host);
  if (name === PAID_HOST) return "paidads";
  if (name === RETENTION_HOST) return "retention";
  return null;
}

const ASSET = /\.(?:svg|png|ico|jpg|jpeg|webp|txt|xml|webmanifest)$/i;

export function destinationPath(host: string | null | undefined, pathname: string) {
  const app = appFromHost(host);
  if (pathname === "/favicon.ico" || pathname === "/icon" || pathname === "/apple-icon") {
    return app ? `/${app}/icon` : pathname;
  }
  if (!app) return pathname;
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/login" ||
    ASSET.test(pathname)
  ) {
    return pathname;
  }
  if (
    pathname === "/paidads" ||
    pathname.startsWith("/paidads/") ||
    pathname === "/retention" ||
    pathname.startsWith("/retention/")
  ) {
    return pathname;
  }
  if (pathname === "/") return `/${app}`;
  return `/${app}${pathname}`;
}

export function requiresSession(pathname: string, destination: string) {
  if (pathname.startsWith("/_next") || ASSET.test(pathname)) return false;
  if (destination === "/" || destination === "/login") return false;
  if (destination === "/api/auth/login" || destination === "/api/health") return false;
  if (destination === "/api/v1/ingest" || destination.endsWith("/api/v1/ingest")) return false;
  if (destination === "/paidads/icon" || destination === "/retention/icon") return false;
  return true;
}

export function safeNext(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return fallback;
  }
  if (value.startsWith("/login") || value.length > 240) return fallback;
  return value;
}

export function otherAppHref(host: string | null | undefined, app: AppId) {
  const other: AppId = app === "paidads" ? "retention" : "paidads";
  if (appFromHost(host)) return `https://${other}.mailbakes.com`;
  return `/${other}`;
}

export function publicBase(host: string | null | undefined, app: AppId) {
  return appFromHost(host) ? "" : `/${app}`;
}
