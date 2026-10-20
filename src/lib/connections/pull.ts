import { redirectUri, type ConnectionSpec } from "@/lib/connections/catalog";
import {
  asNumber,
  clip,
  dayFromIso,
  londonDay,
  type PullResult,
  type PulledDay,
  type PulledPost,
  type TokenSet,
} from "@/lib/connections/model";

export class ProviderError extends Error {
  reconnect: boolean;
  constructor(message: string, reconnect = false) {
    super(message);
    this.name = "ProviderError";
    this.reconnect = reconnect;
  }
}

const GRAPH = "https://graph.facebook.com/v23.0";
const LINKEDIN_VERSION = "202609";
const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

type Json = Record<string, unknown>;

function record(value: unknown): Json {
  return value && typeof value === "object" ? (value as Json) : {};
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { response, body, text: text.slice(0, 400) };
}

function formBody(fields: Record<string, string>) {
  return new URLSearchParams(fields);
}

function expiresFrom(seconds: unknown) {
  const value = asNumber(seconds);
  if (value == null || value <= 0) return null;
  return new Date(Date.now() + value * 1000);
}

function emptyPull(accountId: string, accountName: string, accountMeta: Record<string, string> = {}): PullResult {
  return { accountId, accountName, accountMeta, followers: [], posts: [], days: [] };
}

export async function exchangeCode(spec: ConnectionSpec, code: string): Promise<TokenSet> {
  if (spec.id === "META") {
    const short = await metaToken({
      client_id: env("META_APP_ID"),
      client_secret: env("META_APP_SECRET"),
      redirect_uri: redirectUri(spec.slug),
      code,
    });
    const long = await metaToken({
      grant_type: "fb_exchange_token",
      client_id: env("META_APP_ID"),
      client_secret: env("META_APP_SECRET"),
      fb_exchange_token: short.accessToken,
    });
    return { ...long, scopes: spec.scopes.join(",") };
  }
  if (spec.id === "TIKTOK") {
    return tokenFromForm("https://open.tiktokapis.com/v2/oauth/token/", {
      client_key: env("TIKTOK_CLIENT_KEY"),
      client_secret: env("TIKTOK_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(spec.slug),
    });
  }
  if (spec.id === "YOUTUBE") {
    return tokenFromForm("https://oauth2.googleapis.com/token", {
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri(spec.slug),
      grant_type: "authorization_code",
    });
  }
  if (spec.id === "LINKEDIN") {
    return tokenFromForm("https://www.linkedin.com/oauth/v2/accessToken", {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(spec.slug),
      client_id: env("LINKEDIN_CLIENT_ID"),
      client_secret: env("LINKEDIN_CLIENT_SECRET"),
    });
  }
  return tokenFromForm("https://accounts.snapchat.com/login/oauth2/access_token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(spec.slug),
    client_id: env("SNAPCHAT_CLIENT_ID"),
    client_secret: env("SNAPCHAT_CLIENT_SECRET"),
  });
}

export async function refreshTokens(spec: ConnectionSpec, current: TokenSet): Promise<TokenSet> {
  if (spec.id === "META") {
    const next = await metaToken({
      grant_type: "fb_exchange_token",
      client_id: env("META_APP_ID"),
      client_secret: env("META_APP_SECRET"),
      fb_exchange_token: current.accessToken,
    });
    return { ...next, refreshToken: "", scopes: current.scopes };
  }
  if (!current.refreshToken) throw new ProviderError("That login has expired. Connect it again.", true);
  if (spec.id === "TIKTOK") {
    const next = await tokenFromForm("https://open.tiktokapis.com/v2/oauth/token/", {
      client_key: env("TIKTOK_CLIENT_KEY"),
      client_secret: env("TIKTOK_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
    });
    return { ...next, refreshToken: next.refreshToken || current.refreshToken };
  }
  if (spec.id === "YOUTUBE") {
    const next = await tokenFromForm("https://oauth2.googleapis.com/token", {
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
    });
    return { ...next, refreshToken: next.refreshToken || current.refreshToken };
  }
  if (spec.id === "LINKEDIN") {
    const next = await tokenFromForm("https://www.linkedin.com/oauth/v2/accessToken", {
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
      client_id: env("LINKEDIN_CLIENT_ID"),
      client_secret: env("LINKEDIN_CLIENT_SECRET"),
    });
    return { ...next, refreshToken: next.refreshToken || current.refreshToken };
  }
  const next = await tokenFromForm("https://accounts.snapchat.com/login/oauth2/access_token", {
    grant_type: "refresh_token",
    refresh_token: current.refreshToken,
    client_id: env("SNAPCHAT_CLIENT_ID"),
    client_secret: env("SNAPCHAT_CLIENT_SECRET"),
  });
  return { ...next, refreshToken: next.refreshToken || current.refreshToken };
}

export async function pullAccount(spec: ConnectionSpec, token: string, meta: Record<string, string>): Promise<PullResult> {
  if (spec.id === "META") return pullMeta(token);
  if (spec.id === "TIKTOK") return pullTikTok(token);
  if (spec.id === "YOUTUBE") return pullYouTube(token);
  if (spec.id === "LINKEDIN") return pullLinkedIn(token);
  return pullSnapchat(token, meta);
}

function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new ProviderError(`Add ${name} on the server before connecting.`);
  return value;
}

async function metaToken(params: Record<string, string>): Promise<TokenSet> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const { response, body } = await requestJson(url.toString());
  const data = record(body);
  const error = record(data.error);
  if (!response.ok || typeof data.access_token !== "string") {
    throw new ProviderError(typeof error.message === "string" ? error.message : "Meta didn't accept that login.", error.code === 190);
  }
  return {
    accessToken: data.access_token,
    refreshToken: "",
    expiresAt: expiresFrom(data.expires_in),
    scopes: "",
  };
}

async function tokenFromForm(url: string, fields: Record<string, string>): Promise<TokenSet> {
  const { response, body } = await requestJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody(fields),
  });
  const data = record(body);
  const message =
    (typeof data.error_description === "string" && data.error_description) ||
    (typeof data.error === "string" && data.error) ||
    (typeof record(data.error).message === "string" && (record(data.error).message as string)) ||
    "The platform didn't accept that login.";
  const reconnect = /invalid_grant|expired|revoked/i.test(message);
  if (!response.ok || typeof data.access_token !== "string") throw new ProviderError(message, reconnect);
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : "",
    expiresAt: expiresFrom(data.expires_in),
    scopes: typeof data.scope === "string" ? data.scope : "",
  };
}

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = path.startsWith("http") ? new URL(path) : new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  if (!path.startsWith("http")) {
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("access_token", token);
  }
  const { response, body } = await requestJson(url.toString());
  const data = record(body);
  const error = record(data.error);
  if (!response.ok || data.error) {
    throw new ProviderError(
      typeof error.message === "string" ? error.message : "Meta couldn't be read.",
      error.code === 190 || error.code === 102,
    );
  }
  return data;
}

async function pullMeta(userToken: string): Promise<PullResult> {
  const pages = await graphGet("me/accounts", userToken, {
    fields: "id,name,access_token,fan_count,followers_count,instagram_business_account{id,username,name,followers_count}",
    limit: "50",
  });
  const list = Array.isArray(pages.data) ? pages.data.map(record) : [];
  const page = list.find((item) => record(item.instagram_business_account).id) ?? list[0];
  if (!page || typeof page.id !== "string" || typeof page.access_token !== "string") {
    throw new ProviderError("Meta didn't return a Facebook Page. Millie needs to be a Page admin.");
  }
  const pageToken = page.access_token;
  const ig = record(page.instagram_business_account);
  const result = emptyPull(page.id, typeof page.name === "string" ? page.name : "Facebook Page", {
    pageId: page.id,
    igUserId: typeof ig.id === "string" ? ig.id : "",
  });
  const pageFollowers = asNumber(page.followers_count) ?? asNumber(page.fan_count);
  if (pageFollowers != null) result.followers.push({ platform: "FACEBOOK", count: pageFollowers });
  const igFollowers = asNumber(ig.followers_count);
  if (igFollowers != null) result.followers.push({ platform: "INSTAGRAM", count: igFollowers });
  if (typeof ig.username === "string" && ig.username) result.accountName = `@${ig.username}`;

  const since = String(Math.floor((Date.now() - LOOKBACK_MS) / 1000));
  const fbPosts = await graphList(
    `${GRAPH}/${page.id}/published_posts`,
    pageToken,
    {
      fields: "id,message,created_time,permalink_url,shares,comments.summary(true),reactions.summary(true)",
      since,
      limit: "25",
    },
    4,
  );
  for (const post of fbPosts.slice(0, 20)) {
    const id = typeof post.id === "string" ? post.id : "";
    const publishedOn = typeof post.created_time === "string" ? dayFromIso(post.created_time) : null;
    if (!id || !publishedOn) continue;
    let views: number | null = null;
    try {
      const insights = await graphGet(`${id}/insights`, pageToken, { metric: "post_media_view" });
      const first = Array.isArray(insights.data) ? record(insights.data[0]) : {};
      const values = Array.isArray(first.values) ? record(first.values[0]) : {};
      views = asNumber(values.value);
    } catch {
      views = null;
    }
    const message = typeof post.message === "string" ? post.message : "";
    result.posts.push({
      platform: "FACEBOOK",
      externalId: id,
      title: clip(message || "Facebook post"),
      caption: message.slice(0, 5000),
      publishedOn,
      permalink: typeof post.permalink_url === "string" ? post.permalink_url : "",
      views,
      likes: asNumber(record(record(post.reactions).summary).total_count),
      comments: asNumber(record(record(post.comments).summary).total_count),
      shares: asNumber(record(post.shares).count),
      saves: null,
      linkClicks: null,
    });
  }

  if (typeof ig.id === "string") {
    const media = await graphList(
      `${GRAPH}/${ig.id}/media`,
      pageToken,
      { fields: "id,caption,media_type,timestamp,permalink,like_count,comments_count", limit: "25" },
      4,
    );
    const cutoff = Date.now() - LOOKBACK_MS;
    let instagramCount = 0;
    for (const item of media) {
      if (instagramCount >= 25) break;
      const id = typeof item.id === "string" ? item.id : "";
      const publishedOn = typeof item.timestamp === "string" ? dayFromIso(item.timestamp) : null;
      if (!id || !publishedOn || new Date(String(item.timestamp)).getTime() < cutoff) continue;
      const insight = await instagramInsight(id, pageToken);
      const caption = typeof item.caption === "string" ? item.caption : "";
      result.posts.push({
        platform: "INSTAGRAM",
        externalId: id,
        title: clip(caption || "Instagram post"),
        caption: caption.slice(0, 5000),
        publishedOn,
        permalink: typeof item.permalink === "string" ? item.permalink : "",
        views: insight.views,
        likes: insight.likes ?? asNumber(item.like_count),
        comments: insight.comments ?? asNumber(item.comments_count),
        shares: insight.shares,
        saves: insight.saves,
        linkClicks: insight.linkClicks,
      });
      instagramCount += 1;
    }
  }
  return result;
}

async function instagramInsight(id: string, token: string) {
  const metrics = ["views,likes,comments,shares,saved", "views"];
  for (const metric of metrics) {
    try {
      const insights = await graphGet(`${id}/insights`, token, { metric });
      const found: Record<string, number | null> = {};
      for (const row of Array.isArray(insights.data) ? insights.data : []) {
        const item = record(row);
        const name = typeof item.name === "string" ? item.name : "";
        const values = Array.isArray(item.values) ? record(item.values[0]) : {};
        found[name] = asNumber(values.value);
      }
      return {
        views: found.views ?? null,
        likes: found.likes ?? null,
        comments: found.comments ?? null,
        shares: found.shares ?? null,
        saves: found.saved ?? null,
        linkClicks: found.link_clicks ?? null,
      };
    } catch (error) {
      if (error instanceof ProviderError && error.reconnect) throw error;
    }
  }
  return { views: null, likes: null, comments: null, shares: null, saves: null, linkClicks: null };
}

async function graphList(path: string, token: string, params: Record<string, string>, pages: number) {
  const rows: Json[] = [];
  let next: string | null = null;
  const first = new URL(path.startsWith("http") ? path : `${GRAPH}/${path}`);
  for (const [key, value] of Object.entries(params)) first.searchParams.set(key, value);
  first.searchParams.set("access_token", token);
  next = first.toString();
  for (let index = 0; index < pages && next; index += 1) {
    const data = await graphGet(next, token);
    if (Array.isArray(data.data)) rows.push(...data.data.map(record));
    const paging = record(data.paging);
    next = typeof paging.next === "string" ? paging.next : null;
  }
  return rows;
}

async function pullTikTok(token: string): Promise<PullResult> {
  const info = await requestJson("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,follower_count", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = record(record(info.body).data);
  const user = record(data.user);
  if (!info.response.ok || typeof user.open_id !== "string") {
    throw new ProviderError(tikTokMessage(info.body), info.response.status === 401);
  }
  const name = typeof user.username === "string" && user.username ? `@${user.username}` : String(user.display_name ?? "TikTok");
  const result = emptyPull(user.open_id, name);
  const followers = asNumber(user.follower_count);
  if (followers != null) result.followers.push({ platform: "TIKTOK", count: followers });
  let cursor: string | number | null = null;
  const cutoff = Math.floor((Date.now() - LOOKBACK_MS) / 1000);
  for (let page = 0; page < 5; page += 1) {
    const body: Json = { max_count: 20 };
    if (cursor != null) body.cursor = cursor;
    const listed = await requestJson(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,create_time,share_url,view_count,like_count,comment_count,share_count",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload = record(record(listed.body).data);
    if (!listed.response.ok) throw new ProviderError(tikTokMessage(listed.body), listed.response.status === 401);
    const videos = Array.isArray(payload.videos) ? payload.videos.map(record) : [];
    let older = false;
    for (const video of videos) {
      const created = asNumber(video.create_time);
      if (created == null || typeof video.id !== "string") continue;
      if (created < cutoff) {
        older = true;
        continue;
      }
      const caption = typeof video.video_description === "string" ? video.video_description : "";
      const title = typeof video.title === "string" && video.title ? video.title : caption;
      result.posts.push({
        platform: "TIKTOK",
        externalId: video.id,
        title: clip(title || "TikTok video"),
        caption: caption.slice(0, 5000),
        publishedOn: londonDay(new Date(created * 1000)),
        permalink: typeof video.share_url === "string" ? video.share_url : "",
        views: asNumber(video.view_count),
        likes: asNumber(video.like_count),
        comments: asNumber(video.comment_count),
        shares: asNumber(video.share_count),
        saves: null,
        linkClicks: null,
      });
    }
    if (older || payload.has_more !== true) break;
    cursor = (payload.cursor as string | number | null) ?? null;
    if (cursor == null) break;
  }
  return result;
}

function tikTokMessage(body: unknown) {
  const data = record(body);
  const error = record(data.error);
  return (
    (typeof error.message === "string" && error.message) ||
    (typeof data.error_description === "string" && data.error_description) ||
    "TikTok couldn't be read."
  );
}

async function pullYouTube(token: string): Promise<PullResult> {
  const headers = { Authorization: `Bearer ${token}` };
  const channelRes = await requestJson(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true",
    { headers },
  );
  const channelBody = record(channelRes.body);
  if (channelRes.response.status === 401) throw new ProviderError("YouTube needs connecting again.", true);
  if (!channelRes.response.ok) throw new ProviderError(googleMessage(channelBody));
  const channel = Array.isArray(channelBody.items) ? record(channelBody.items[0]) : {};
  const channelId = typeof channel.id === "string" ? channel.id : "";
  if (!channelId) throw new ProviderError("YouTube didn't return a channel for this login.");
  const snippet = record(channel.snippet);
  const statistics = record(channel.statistics);
  const uploads = record(record(channel.contentDetails).relatedPlaylists).uploads;
  const result = emptyPull(channelId, typeof snippet.title === "string" ? snippet.title : "YouTube", {
    channelId,
    uploads: typeof uploads === "string" ? uploads : "",
  });
  const followers = asNumber(statistics.subscriberCount);
  if (followers != null) result.followers.push({ platform: "YOUTUBE_SHORTS", count: followers });
  if (typeof uploads !== "string") return result;

  const ids: { id: string; publishedOn: string; title: string }[] = [];
  let pageToken = "";
  const cutoff = Date.now() - LOOKBACK_MS;
  for (let page = 0; page < 3; page += 1) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "contentDetails,snippet");
    url.searchParams.set("playlistId", uploads);
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const listed = await requestJson(url.toString(), { headers });
    if (!listed.response.ok) throw new ProviderError(googleMessage(record(listed.body)), listed.response.status === 401);
    const payload = record(listed.body);
    let older = false;
    for (const item of Array.isArray(payload.items) ? payload.items.map(record) : []) {
      const details = record(item.contentDetails);
      const itemSnippet = record(item.snippet);
      const published = typeof details.videoPublishedAt === "string" ? details.videoPublishedAt : itemSnippet.publishedAt;
      const id = typeof details.videoId === "string" ? details.videoId : "";
      if (!id || typeof published !== "string") continue;
      if (new Date(published).getTime() < cutoff) {
        older = true;
        continue;
      }
      const day = dayFromIso(published);
      if (!day) continue;
      ids.push({ id, publishedOn: day, title: typeof itemSnippet.title === "string" ? itemSnippet.title : "YouTube Short" });
    }
    pageToken = typeof payload.nextPageToken === "string" ? payload.nextPageToken : "";
    if (older || !pageToken) break;
  }

  const shares = new Map<string, number | null>();
  const end = londonDay();
  const start = londonDay(new Date(Date.now() - LOOKBACK_MS));
  const analytics = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  analytics.searchParams.set("ids", "channel==MINE");
  analytics.searchParams.set("startDate", start);
  analytics.searchParams.set("endDate", end);
  analytics.searchParams.set("metrics", "views,likes,comments,shares");
  analytics.searchParams.set("dimensions", "video");
  analytics.searchParams.set("maxResults", "200");
  analytics.searchParams.set("sort", "-views");
  const report = await requestJson(analytics.toString(), { headers });
  if (report.response.ok) {
    const rows = Array.isArray(record(report.body).rows) ? (record(report.body).rows as unknown[]) : [];
    for (const row of rows) {
      if (!Array.isArray(row) || typeof row[0] !== "string") continue;
      shares.set(row[0], asNumber(row[4]));
    }
  }

  for (let index = 0; index < ids.length; index += 50) {
    const slice = ids.slice(index, index + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "statistics,contentDetails,snippet");
    url.searchParams.set("id", slice.map((item) => item.id).join(","));
    const videos = await requestJson(url.toString(), { headers });
    if (!videos.response.ok) throw new ProviderError(googleMessage(record(videos.body)), videos.response.status === 401);
    for (const item of Array.isArray(record(videos.body).items) ? (record(videos.body).items as unknown[]).map(record) : []) {
      const id = typeof item.id === "string" ? item.id : "";
      const duration = seconds(typeof record(item.contentDetails).duration === "string" ? String(record(item.contentDetails).duration) : "");
      if (!id || duration == null || duration > 180) continue;
      const known = slice.find((entry) => entry.id === id);
      const stats = record(item.statistics);
      const itemSnippet = record(item.snippet);
      const title = typeof itemSnippet.title === "string" ? itemSnippet.title : known?.title || "YouTube Short";
      result.posts.push({
        platform: "YOUTUBE_SHORTS",
        externalId: id,
        title: clip(title),
        caption: typeof itemSnippet.description === "string" ? itemSnippet.description.slice(0, 5000) : "",
        publishedOn: known?.publishedOn || londonDay(),
        permalink: `https://www.youtube.com/shorts/${id}`,
        views: asNumber(stats.viewCount),
        likes: asNumber(stats.likeCount),
        comments: asNumber(stats.commentCount),
        shares: shares.get(id) ?? null,
        saves: null,
        linkClicks: null,
      });
    }
  }
  return result;
}

function seconds(iso: string) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function googleMessage(body: Json) {
  const error = record(body.error);
  return typeof error.message === "string" ? error.message : "YouTube couldn't be read.";
}

async function linkedinGet(path: string, token: string) {
  const { response, body } = await requestJson(`https://api.linkedin.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  if (response.status === 401) throw new ProviderError("LinkedIn needs connecting again.", true);
  if (!response.ok) {
    const message = typeof record(body).message === "string" ? String(record(body).message) : "LinkedIn couldn't be read.";
    throw new ProviderError(message);
  }
  return record(body);
}

async function pullLinkedIn(token: string): Promise<PullResult> {
  const acls = await linkedinGet("/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED", token);
  const element = Array.isArray(acls.elements) ? record(acls.elements[0]) : {};
  const urn = typeof element.organization === "string" ? element.organization : typeof element.organizationalTarget === "string" ? element.organizationalTarget : "";
  if (!urn.startsWith("urn:li:organization")) throw new ProviderError("LinkedIn didn't return a Company Page you administer.");
  const orgId = urn.split(":").pop() ?? "";
  let name = `LinkedIn ${orgId}`;
  try {
    const org = await linkedinGet(`/rest/organizations/${orgId}`, token);
    if (typeof org.localizedName === "string") name = org.localizedName;
  } catch (error) {
    if (error instanceof ProviderError && error.reconnect) throw error;
  }
  const result = emptyPull(urn, name, { organization: urn });
  try {
    const followers = await linkedinGet(
      `/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(urn)}`,
      token,
    );
    const first = Array.isArray(followers.elements) ? record(followers.elements[0]) : {};
    const counts = record(first.followerCounts);
    const organic = asNumber(counts.organicFollowerCount);
    if (organic != null) result.followers.push({ platform: "LINKEDIN", count: organic });
  } catch (error) {
    if (error instanceof ProviderError && error.reconnect) throw error;
  }

  let postsBody: Json = {};
  try {
    postsBody = await linkedinGet(`/rest/posts?q=author&author=${encodeURIComponent(urn)}&count=50`, token);
  } catch (error) {
    if (error instanceof ProviderError && error.reconnect) throw error;
    postsBody = {};
  }
  const cutoff = Date.now() - LOOKBACK_MS;
  const posts = (Array.isArray(postsBody.elements) ? postsBody.elements.map(record) : []).filter((post) => {
    const published = asNumber(post.publishedAt);
    return typeof post.id === "string" && published != null && published >= cutoff;
  });
  const shareIds = posts.map((post) => String(post.id)).filter((id) => id.includes(":share:") || id.includes(":ugcPost:"));
  const stats = new Map<string, Json>();
  for (let index = 0; index < shareIds.length; index += 10) {
    const slice = shareIds.slice(index, index + 10);
    const shares = slice.filter((id) => id.includes(":share:"));
    const ugc = slice.filter((id) => id.includes(":ugcPost:"));
    const params = new URLSearchParams();
    params.set("q", "organizationalEntity");
    params.set("organizationalEntity", urn);
    if (shares.length) params.set("shares", `List(${shares.join(",")})`);
    if (ugc.length) params.set("ugcPosts", `List(${ugc.join(",")})`);
    try {
      const body = await linkedinGet(`/rest/organizationalEntityShareStatistics?${params.toString()}`, token);
      for (const row of Array.isArray(body.elements) ? body.elements.map(record) : []) {
        const id = typeof row.share === "string" ? row.share : typeof row.ugcPost === "string" ? row.ugcPost : "";
        if (id) stats.set(id, record(row.totalShareStatistics));
      }
    } catch (error) {
      if (error instanceof ProviderError && error.reconnect) throw error;
    }
  }
  for (const post of posts) {
    const id = String(post.id);
    const published = asNumber(post.publishedAt);
    const day = published == null ? null : londonDay(new Date(published));
    if (!day) continue;
    const stat = stats.get(id) ?? {};
    const commentary = typeof post.commentary === "string" ? post.commentary : "";
    result.posts.push({
      platform: "LINKEDIN",
      externalId: id,
      title: clip(commentary || "LinkedIn post"),
      caption: commentary.slice(0, 5000),
      publishedOn: day,
      permalink: "",
      views: asNumber(stat.impressionCount),
      likes: asNumber(stat.likeCount),
      comments: asNumber(stat.commentCount),
      shares: asNumber(stat.shareCount),
      saves: null,
      linkClicks: asNumber(stat.clickCount),
    });
  }
  if (result.posts.length === 0) {
    const end = Date.now();
    const start = end - 28 * 24 * 60 * 60 * 1000;
    try {
      const daily = await linkedinGet(
        `/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(urn)}&timeIntervals=(timeRange:(start:${start},end:${end}),timeGranularityType:DAY)`,
        token,
      );
      for (const row of Array.isArray(daily.elements) ? daily.elements.map(record) : []) {
        const range = record(row.timeRange);
        const startMs = asNumber(range.start);
        const stat = record(row.totalShareStatistics);
        if (startMs == null) continue;
        result.days.push(dayRow("LINKEDIN", londonDay(new Date(startMs)), stat, "impressionCount", "likeCount", "commentCount", "shareCount", "clickCount"));
      }
    } catch (error) {
      if (error instanceof ProviderError && error.reconnect) throw error;
    }
  }
  return result;
}

function dayRow(
  platform: PulledDay["platform"],
  day: string,
  stat: Json,
  viewsKey: string,
  likesKey: string,
  commentsKey: string,
  sharesKey: string,
  clicksKey: string,
): PulledDay {
  return {
    platform,
    day,
    views: asNumber(stat[viewsKey]),
    likes: asNumber(stat[likesKey]),
    comments: asNumber(stat[commentsKey]),
    shares: asNumber(stat[sharesKey]),
    saves: null,
    linkClicks: asNumber(stat[clicksKey]),
  };
}

async function pullSnapchat(token: string, meta: Record<string, string>): Promise<PullResult> {
  const headers = { Authorization: `Bearer ${token}` };
  let profile = record(meta.profileId ? { id: meta.profileId } : {});
  const mine = await requestJson("https://businessapi.snapchat.com/v1/public_profiles/my_profile", { headers });
  if (mine.response.status === 401) throw new ProviderError("Snapchat needs connecting again.", true);
  if (mine.response.ok) profile = snapProfile(mine.body) ?? profile;
  if (!mine.response.ok && mine.response.status !== 404) {
    throw new ProviderError(snapMessage(mine.body, mine.response.status), false);
  }
  const id = typeof profile.id === "string" ? profile.id : "";
  if (!id) throw new ProviderError("Snapchat connected, but no Public Profile came back. The app may still need allowlisting.");
  const name =
    (typeof profile.snap_user_name === "string" && profile.snap_user_name && `@${profile.snap_user_name}`) ||
    (typeof profile.display_name === "string" && profile.display_name) ||
    "Snapchat";
  const result = emptyPull(id, name, { profileId: id });
  const followers = asNumber(profile.subscriber_count);
  if (followers != null) result.followers.push({ platform: "SNAPCHAT", count: followers });

  const listed = await requestJson(`https://businessapi.snapchat.com/v1/public_profiles/${id}/spotlights?limit=50`, { headers });
  const spotlights = listed.response.ok ? snapAssets(listed.body) : [];
  const statsRes = await requestJson(
    `https://businessapi.snapchat.com/v1/public_profiles/${id}/stats?assetType=SPOTLIGHT&granularity=LIFETIME&fields=SPOTLIGHT_VIEWS,SPOTLIGHT_SHARES,SPOTLIGHT_FAVORITES&limit=50`,
    { headers },
  );
  const statMap = statsRes.response.ok ? snapStats(statsRes.body) : new Map<string, Json>();
  const cutoff = Date.now() - LOOKBACK_MS;
  for (const asset of spotlights) {
    const assetId = typeof asset.id === "string" ? asset.id : typeof asset.spotlight_id === "string" ? asset.spotlight_id : "";
    const created = typeof asset.created_at === "string" ? asset.created_at : typeof asset.createdAt === "string" ? asset.createdAt : "";
    const day = created ? dayFromIso(created) : null;
    if (!assetId || !day || new Date(created).getTime() < cutoff) continue;
    const stat = statMap.get(assetId) ?? {};
    const caption = typeof asset.caption === "string" ? asset.caption : typeof asset.title === "string" ? asset.title : "";
    result.posts.push({
      platform: "SNAPCHAT",
      externalId: assetId,
      title: clip(caption || "Snapchat Spotlight"),
      caption: caption.slice(0, 5000),
      publishedOn: day,
      permalink: "",
      views: asNumber(stat.SPOTLIGHT_VIEWS),
      likes: asNumber(stat.SPOTLIGHT_FAVORITES),
      comments: null,
      shares: asNumber(stat.SPOTLIGHT_SHARES),
      saves: null,
      linkClicks: null,
    });
  }
  if (result.posts.length === 0) {
    const end = new Date();
    const start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const stamp = (date: Date) => `${londonDay(date)}T00:00:00`;
    const daily = await requestJson(
      `https://businessapi.snapchat.com/v1/public_profiles/${id}/stats?assetType=PROFILE&granularity=DAY&fields=VIEWS,SHARES&startTime=${stamp(start)}&endTime=${stamp(end)}`,
      { headers },
    );
    if (daily.response.ok) {
      for (const [day, stat] of snapDaily(daily.body)) {
        result.days.push(dayRow("SNAPCHAT", day, stat, "VIEWS", "LIKES", "COMMENTS", "SHARES", "LINK_CLICKS"));
      }
    }
  }
  return result;
}

function snapProfile(body: unknown) {
  const data = record(body);
  const list = Array.isArray(data.public_profiles) ? data.public_profiles.map(record) : [];
  const first = list[0] ? record(list[0].public_profile) : record(data.public_profile);
  return typeof first.id === "string" ? first : null;
}

function snapAssets(body: unknown) {
  const data = record(body);
  const keys = ["spotlights", "assets", "public_profiles"];
  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key].map(record);
  }
  return [] as Json[];
}

function snapStats(body: unknown) {
  const map = new Map<string, Json>();
  const data = record(body);
  const assets = Array.isArray(data.assets) ? data.assets.map(record) : [];
  for (const asset of assets) {
    const id = typeof asset.asset_id === "string" ? asset.asset_id : "";
    if (!id) continue;
    const totals: Json = {};
    const series = Array.isArray(asset.timeseries) ? asset.timeseries.map(record) : [];
    for (const point of series) {
      for (const field of Array.isArray(point.fields) ? point.fields.map(record) : []) {
        const name = record(field.field).field_name ?? record(field.field).fieldName;
        const stats = Array.isArray(field.stats) ? field.stats.map(record) : [];
        const value = stats.reduce((sum, item) => sum + (asNumber(item.value) ?? 0), 0);
        if (typeof name === "string") totals[name] = (asNumber(totals[name]) ?? 0) + value;
      }
    }
    map.set(id, totals);
  }
  return map;
}

function snapDaily(body: unknown) {
  const rows: [string, Json][] = [];
  const data = record(body);
  const assets = Array.isArray(data.assets) ? data.assets.map(record) : [];
  for (const asset of assets) {
    for (const point of Array.isArray(asset.timeseries) ? asset.timeseries.map(record) : []) {
      const start = typeof point.start_time === "string" ? dayFromIso(point.start_time) : null;
      if (!start) continue;
      const totals: Json = {};
      for (const field of Array.isArray(point.fields) ? point.fields.map(record) : []) {
        const name = record(field.field).field_name ?? record(field.field).fieldName;
        const stats = Array.isArray(field.stats) ? field.stats.map(record) : [];
        const value = stats.reduce((sum, item) => sum + (asNumber(item.value) ?? 0), 0);
        if (typeof name === "string") totals[name] = value;
      }
      rows.push([start, totals]);
    }
  }
  return rows;
}

function snapMessage(body: unknown, status: number) {
  const data = record(body);
  const debug = typeof data.debug_message === "string" ? data.debug_message : "";
  if (status === 403 || /allowlist|permission/i.test(debug)) {
    return "Snapchat still needs to allowlist this app for the Public Profile API.";
  }
  return debug || "Snapchat couldn't be read.";
}

export function tokenDue(expiresAt: Date | null, platform: ConnectionSpec["id"]) {
  if (!expiresAt) return false;
  const lead = platform === "META" ? 10 * 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
  return expiresAt.getTime() - Date.now() < lead;
}

export type { PulledPost };
