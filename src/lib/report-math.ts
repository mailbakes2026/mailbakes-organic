import { CHANNELS, type ChannelId, platformLabel } from "@/lib/constants";
import type { PlatformId, PostDTO, PostStatDTO } from "@/lib/types";

export type MetricName = "views" | "likes" | "comments" | "shares" | "saves" | "linkClicks";

export const METRICS: { key: MetricName; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
  { key: "linkClicks", label: "Link clicks" },
];

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function startOfWeek(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDays(iso, diff);
}

export function weekRange(iso: string) {
  const start = startOfWeek(iso);
  return { start, end: addDays(start, 6) };
}

export function londonToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function inWeek(iso: string, start: string, end: string) {
  return iso >= start && iso <= end;
}

export function publishedPosts(posts: PostDTO[], start: string, end: string) {
  return posts.filter((post) => post.status === "APPROVED" && inWeek(post.plannedDate, start, end));
}

export function channelPosts(posts: PostDTO[], channelId: ChannelId) {
  const channel = CHANNELS.find((item) => item.id === channelId);
  if (!channel) return [];
  return posts.filter((post) => channel.platforms.some((platform) => post.platforms.includes(platform)));
}

export function statFor(post: PostDTO, platform: PlatformId) {
  return post.stats.find((item) => item.platform === platform) ?? null;
}

export function interactionsOf(stat: Pick<PostStatDTO, "likes" | "comments" | "shares" | "saves"> | null) {
  if (!stat) return null;
  const values = [stat.likes, stat.comments, stat.shares, stat.saves];
  if (values.every((value) => value == null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

/** Likes, comments, shares and saves divided by views. Null when views are missing or zero. */
export function engagementOf(stat: PostStatDTO | null) {
  const interactions = interactionsOf(stat);
  if (interactions == null || stat?.views == null || stat.views <= 0) return null;
  return interactions / stat.views;
}

export function sumMetric(stats: (PostStatDTO | null)[], key: MetricName) {
  const present = stats.filter((stat): stat is PostStatDTO => stat != null && stat[key] != null);
  if (present.length === 0) return null;
  return present.reduce((sum, stat) => sum + (stat[key] ?? 0), 0);
}

export type MeasuredPost = {
  post: PostDTO;
  platform: PlatformId;
  stat: PostStatDTO;
  interactions: number | null;
  rate: number | null;
};

export function measuredPosts(posts: PostDTO[]): MeasuredPost[] {
  const rows: MeasuredPost[] = [];
  for (const post of posts) {
    for (const platform of post.platforms) {
      const stat = statFor(post, platform);
      if (!stat) continue;
      const interactions = interactionsOf(stat);
      const rate = engagementOf(stat);
      if (interactions == null && stat.views == null && stat.linkClicks == null) continue;
      rows.push({ post, platform, stat, interactions, rate });
    }
  }
  return rows;
}

export function rankMeasured(rows: MeasuredPost[]) {
  const withRate = rows.filter((row) => row.rate != null);
  const pool = withRate.length > 0 ? withRate : rows.filter((row) => (row.interactions ?? 0) > 0 || (row.stat.views ?? 0) > 0);
  const sorted = [...pool].sort((a, b) => {
    const rate = (b.rate ?? -1) - (a.rate ?? -1);
    if (rate !== 0) return rate;
    return (b.interactions ?? 0) - (a.interactions ?? 0);
  });
  return sorted;
}

export function formatCount(value: number | null) {
  if (value == null) return "—";
  return value.toLocaleString("en-GB");
}

export function formatRate(rate: number | null) {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatDelta(current: number, previous: number) {
  const diff = current - previous;
  if (diff === 0) return "No change";
  const sign = diff > 0 ? "+" : "−";
  return `${sign}${Math.abs(diff).toLocaleString("en-GB")} vs last week`;
}

export function deltaTone(current: number, previous: number) {
  if (current === previous) return "flat";
  return current > previous ? "up" : "down";
}

function platformPhrase(platform: PlatformId) {
  return platformLabel(platform);
}

function measuredLine(row: MeasuredPost) {
  const rate = row.rate == null ? "no view count" : formatRate(row.rate);
  const interactions = row.interactions == null ? "no interaction numbers" : `${formatCount(row.interactions)} interactions`;
  const views = row.stat.views == null ? "" : ` from ${formatCount(row.stat.views)} views`;
  return `“${row.post.title}” on ${platformPhrase(row.platform)} (${rate}, ${interactions}${views})`;
}

export function weekSummary(posts: PostDTO[], previous: PostDTO[]) {
  const total = posts.length;
  const prevTotal = previous.length;
  const diff = total - prevTotal;
  const volume =
    diff === 0
      ? `${total} approved ${total === 1 ? "post" : "posts"}, the same as last week`
      : diff > 0
        ? `${total} approved ${total === 1 ? "post" : "posts"}, ${diff} more than last week`
        : `${total} approved ${total === 1 ? "post" : "posts"}, ${Math.abs(diff)} fewer than last week`;

  const busiest = CHANNELS.map((channel) => ({
    label: channel.label,
    count: channelPosts(posts, channel.id).length,
  })).sort((a, b) => b.count - a.count)[0];
  const busiestText = busiest && busiest.count > 0 ? ` ${busiest.label} had the most, with ${busiest.count}.` : "";

  const ranked = rankMeasured(measuredPosts(posts));
  if (ranked.length === 0) {
    return `This week: ${volume}.${busiestText} No performance numbers have been entered yet, so there is nothing to compare.`;
  }
  const top = ranked[0];
  const bottom = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const worked = ` What worked: ${measuredLine(top)}.`;
  const didnt = bottom ? ` What didn’t: ${measuredLine(bottom)}.` : " Only one post has stats, so there isn’t a weaker post to compare.";
  return `This week: ${volume}.${busiestText}${worked}${didnt}`;
}
