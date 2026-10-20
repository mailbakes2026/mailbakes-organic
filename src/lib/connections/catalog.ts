import type { ConnectionId } from "@/lib/connections/model";

export type ConnectionSpec = {
  id: ConnectionId;
  slug: string;
  label: string;
  blurb: string;
  envId: string;
  envSecret: string;
  scopes: string[];
  setup: string[];
};

export const CONNECTIONS: ConnectionSpec[] = [
  {
    id: "META",
    slug: "meta",
    label: "Meta",
    blurb: "Instagram and the Facebook Page, organic posts only. Paid Meta ads in Ryze are left as they are.",
    envId: "META_APP_ID",
    envSecret: "META_APP_SECRET",
    scopes: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_read_user_content",
      "read_insights",
      "instagram_basic",
      "instagram_manage_insights",
      "business_management",
    ],
    setup: [
      "Create a Meta app at developers.facebook.com and add Facebook Login.",
      "Add the Instagram product, then link the Instagram professional account to the Facebook Page.",
      "App review for pages_show_list, pages_read_engagement, pages_read_user_content, read_insights, instagram_basic, instagram_manage_insights and business_management.",
      "Put the app id in META_APP_ID and the app secret in META_APP_SECRET.",
    ],
  },
  {
    id: "TIKTOK",
    slug: "tiktok",
    label: "TikTok",
    blurb: "Organic videos from the TikTok account. TikTok ads stay out of this.",
    envId: "TIKTOK_CLIENT_KEY",
    envSecret: "TIKTOK_CLIENT_SECRET",
    scopes: ["user.info.basic", "user.info.stats", "video.list"],
    setup: [
      "Create a TikTok developer app and add the Login Kit.",
      "Request the Display API scopes user.info.basic, user.info.stats and video.list.",
      "Put the client key in TIKTOK_CLIENT_KEY and the client secret in TIKTOK_CLIENT_SECRET.",
    ],
  },
  {
    id: "YOUTUBE",
    slug: "youtube",
    label: "YouTube",
    blurb: "YouTube Shorts from the channel. Google Ads are not used.",
    envId: "GOOGLE_CLIENT_ID",
    envSecret: "GOOGLE_CLIENT_SECRET",
    scopes: ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/yt-analytics.readonly"],
    setup: [
      "In Google Cloud, enable YouTube Data API v3 and YouTube Analytics API.",
      "Create an OAuth client of type Web application.",
      "Scopes used are youtube.readonly and yt-analytics.readonly.",
      "Put the client id in GOOGLE_CLIENT_ID and the client secret in GOOGLE_CLIENT_SECRET.",
    ],
  },
  {
    id: "LINKEDIN",
    slug: "linkedin",
    label: "LinkedIn",
    blurb: "Organic Company Page posts. Sponsored posts are not included.",
    envId: "LINKEDIN_CLIENT_ID",
    envSecret: "LINKEDIN_CLIENT_SECRET",
    scopes: ["r_organization_social", "r_organization_followers", "rw_organization_admin"],
    setup: [
      "Create a LinkedIn app and apply for the Community Management API.",
      "Millie needs the ADMINISTRATOR role on the Company Page.",
      "Scopes are r_organization_social, r_organization_followers and rw_organization_admin.",
      "Put the client id in LINKEDIN_CLIENT_ID and the client secret in LINKEDIN_CLIENT_SECRET.",
    ],
  },
  {
    id: "SNAPCHAT",
    slug: "snapchat",
    label: "Snapchat",
    blurb: "Public Profile stats. Snapchat ads are not used.",
    envId: "SNAPCHAT_CLIENT_ID",
    envSecret: "SNAPCHAT_CLIENT_SECRET",
    scopes: ["snapchat-profile-api"],
    setup: [
      "Create the OAuth app in Snapchat Ads Manager under Business Details. The Developer Portal client will not work.",
      "Send that client id to Snap and ask them to allowlist it for the Public Profile API.",
      "Scope is snapchat-profile-api.",
      "Put the client id in SNAPCHAT_CLIENT_ID and the client secret in SNAPCHAT_CLIENT_SECRET.",
    ],
  },
];

export function connectionBySlug(slug: string) {
  return CONNECTIONS.find((item) => item.slug === slug) ?? null;
}

export function connectionById(id: string) {
  return CONNECTIONS.find((item) => item.id === id) ?? null;
}

export function appUrl() {
  return (process.env.APP_URL || "https://mailbakes-organic.onrender.com").replace(/\/$/, "");
}

export function redirectUri(slug: string) {
  return `${appUrl()}/api/connections/callback/${slug}`;
}

export function missingCredentials(spec: ConnectionSpec) {
  const missing: string[] = [];
  if (!process.env[spec.envId]?.trim()) missing.push(spec.envId);
  if (!process.env[spec.envSecret]?.trim()) missing.push(spec.envSecret);
  return missing;
}

export function credentialsReady(spec: ConnectionSpec) {
  return missingCredentials(spec).length === 0;
}

function stateKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
  return secret;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hmacKey() {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(stateKey()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signState(slug: string, userId: string) {
  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = toBase64Url(
    new TextEncoder().encode(JSON.stringify({ slug, userId, nonce, exp: Date.now() + 10 * 60 * 1000 })),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(payload)),
  );
  return `${payload}.${toBase64Url(signature)}`;
}

export async function readState(value: string) {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const ok = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    fromBase64Url(signature),
    new TextEncoder().encode(payload),
  );
  if (!ok) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as {
      slug?: string;
      userId?: string;
      exp?: number;
    };
    if (!parsed.slug || !parsed.userId || !parsed.exp || parsed.exp < Date.now()) return null;
    return { slug: parsed.slug, userId: parsed.userId };
  } catch {
    return null;
  }
}

export function authorizeUrl(spec: ConnectionSpec, state: string) {
  const redirect = redirectUri(spec.slug);
  const id = process.env[spec.envId]?.trim() ?? "";
  if (spec.id === "META") {
    const url = new URL("https://www.facebook.com/v23.0/dialog/oauth");
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", spec.scopes.join(","));
    return url.toString();
  }
  if (spec.id === "TIKTOK") {
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", id);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", spec.scopes.join(","));
    return url.toString();
  }
  if (spec.id === "YOUTUBE") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("scope", spec.scopes.join(" "));
    return url.toString();
  }
  if (spec.id === "LINKEDIN") {
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", spec.scopes.join(" "));
    return url.toString();
  }
  const url = new URL("https://accounts.snapchat.com/login/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", id);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("scope", spec.scopes.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}
