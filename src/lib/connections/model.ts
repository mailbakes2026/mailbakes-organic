import type { PlatformId } from "../types";

export const CONNECTION_IDS = ["META", "TIKTOK", "YOUTUBE", "LINKEDIN", "SNAPCHAT"] as const;
export type ConnectionId = (typeof CONNECTION_IDS)[number];

export type PulledPost = {
  platform: PlatformId;
  externalId: string;
  title: string;
  caption: string;
  publishedOn: string;
  permalink: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  linkClicks: number | null;
};

export type PulledDay = {
  platform: PlatformId;
  day: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  linkClicks: number | null;
};

export type PullResult = {
  accountId: string;
  accountName: string;
  accountMeta: Record<string, string>;
  followers: { platform: PlatformId; count: number }[];
  posts: PulledPost[];
  days: PulledDay[];
};

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
  scopes: string;
};

export function shouldWriteApiStat(existingSource: "MANUAL" | "API" | null) {
  return existingSource !== "MANUAL";
}

export function londonDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dayFromIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return londonDay(date);
}

export function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Math.round(Number(value));
  return null;
}

export function clip(value: string, max = 180) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function tokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

function jaccard(left: string, right: string) {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / (a.size + b.size - shared || 1);
}

function dayDistance(left: string, right: string) {
  const [ay, am, ad] = left.split("-").map(Number);
  const [by, bm, bd] = right.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.abs(Math.round((a - b) / 86_400_000));
}

export type MatchPost = {
  id: string;
  platforms: string[];
  plannedDate: string;
  title: string;
  caption: string;
};

export function matchExternalPosts(
  external: { externalId: string; platform: string; publishedOn: string; title: string; caption: string }[],
  posts: MatchPost[],
) {
  const pairs: { externalId: string; postId: string; score: number }[] = [];
  for (const item of external) {
    const sameDay = posts.filter(
      (post) => post.platforms.includes(item.platform) && dayDistance(item.publishedOn, post.plannedDate) === 0,
    );
    for (const post of posts) {
      if (!post.platforms.includes(item.platform)) continue;
      const distance = dayDistance(item.publishedOn, post.plannedDate);
      if (distance > 1) continue;
      const text = jaccard(`${item.title} ${item.caption}`, `${post.title} ${post.caption}`);
      const lone = distance === 0 && sameDay.length === 1;
      if (!lone && text < (distance === 0 ? 0.2 : 0.45)) continue;
      pairs.push({
        externalId: item.externalId,
        postId: post.id,
        score: (distance === 0 ? 2 : 1) + text + (lone ? 1 : 0),
      });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const usedExternal = new Set<string>();
  const usedPost = new Set<string>();
  const matched: Record<string, string> = {};
  for (const pair of pairs) {
    if (usedExternal.has(pair.externalId) || usedPost.has(pair.postId)) continue;
    usedExternal.add(pair.externalId);
    usedPost.add(pair.postId);
    matched[pair.externalId] = pair.postId;
  }
  return matched;
}

export type MetricBag = {
  posts: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  linkClicks: number | null;
};

export function emptyBag(): MetricBag {
  return { posts: 0, views: null, likes: null, comments: null, shares: null, saves: null, linkClicks: null };
}

export function addMetric(current: number | null, extra: number | null) {
  if (extra == null) return current;
  if (current == null) return extra;
  return current + extra;
}

export function addBags(left: MetricBag, right: MetricBag): MetricBag {
  return {
    posts: left.posts + right.posts,
    views: addMetric(left.views, right.views),
    likes: addMetric(left.likes, right.likes),
    comments: addMetric(left.comments, right.comments),
    shares: addMetric(left.shares, right.shares),
    saves: addMetric(left.saves, right.saves),
    linkClicks: addMetric(left.linkClicks, right.linkClicks),
  };
}

type OrganicLike = {
  platform: string;
  publishedOn: string;
  matchedPostId: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  linkClicks: number | null;
};
type DayLike = PulledDay;

export function organicBag(
  platforms: string[],
  weekPostIds: Set<string>,
  posts: OrganicLike[],
  days: DayLike[],
  start: string,
  end: string,
) {
  const inWeek = (day: string) => day >= start && day <= end;
  const relevant = posts.filter((post) => platforms.includes(post.platform) && inWeek(post.publishedOn));
  let bag = emptyBag();
  if (relevant.length > 0) {
    for (const post of relevant) {
      if (post.matchedPostId && weekPostIds.has(post.matchedPostId)) continue;
      bag = addBags(bag, {
        posts: 1,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves,
        linkClicks: post.linkClicks,
      });
    }
    return bag;
  }
  for (const day of days) {
    if (!platforms.includes(day.platform) || !inWeek(day.day)) continue;
    bag = addBags(bag, {
      posts: 0,
      views: day.views,
      likes: day.likes,
      comments: day.comments,
      shares: day.shares,
      saves: day.saves,
      linkClicks: day.linkClicks,
    });
  }
  return bag;
}

export function followerAt(points: { platform: string; day: string; followers: number }[], platform: string, end: string) {
  const found = points
    .filter((point) => point.platform === platform && point.day <= end)
    .sort((a, b) => b.day.localeCompare(a.day))[0];
  return found?.followers ?? null;
}
