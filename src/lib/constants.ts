import type { ContentTypeId, PlatformId, StatusId } from "@/lib/types";

export const PLATFORMS: { id: PlatformId; label: string; colour: string }[] = [
  { id: "INSTAGRAM", label: "Instagram", colour: "#E1306C" },
  { id: "FACEBOOK", label: "Facebook", colour: "#1877F2" },
  { id: "TIKTOK", label: "TikTok", colour: "#161616" },
  { id: "LINKEDIN", label: "LinkedIn", colour: "#0A66C2" },
  { id: "YOUTUBE_SHORTS", label: "YouTube Shorts", colour: "#E11D2E" },
  { id: "SNAPCHAT", label: "Snapchat", colour: "#C6A000" },
];

export const STORY_PLATFORMS: PlatformId[] = ["INSTAGRAM", "FACEBOOK", "SNAPCHAT"];

export const CONTENT_TYPES: { id: ContentTypeId; label: string }[] = [
  { id: "FEED", label: "Feed post" },
  { id: "REEL", label: "Reel or short video" },
  { id: "STORY", label: "Story" },
];

export const STATUSES: { id: StatusId; label: string }[] = [
  { id: "DRAFT", label: "Draft" },
  { id: "PENDING_APPROVAL", label: "For approval" },
  { id: "CHANGES_REQUESTED", label: "Needs changes" },
  { id: "AMENDMENTS_MADE", label: "Amendments made" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 8;

export const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export type ChannelId = "META" | "TIKTOK" | "SNAPCHAT" | "LINKEDIN" | "YOUTUBE_SHORTS";

/** Calendar grouping. Instagram and Facebook share one Meta badge. */
export const CHANNELS: {
  id: ChannelId;
  label: string;
  short: string;
  colour: string;
  ink: string;
  platforms: PlatformId[];
}[] = [
  {
    id: "META",
    label: "Meta",
    short: "Meta",
    colour: "#0064E0",
    ink: "#fff",
    platforms: ["INSTAGRAM", "FACEBOOK"],
  },
  { id: "TIKTOK", label: "TikTok", short: "TikTok", colour: "#111111", ink: "#fff", platforms: ["TIKTOK"] },
  { id: "SNAPCHAT", label: "Snapchat", short: "Snap", colour: "#F7D31E", ink: "#1E1A1C", platforms: ["SNAPCHAT"] },
  { id: "LINKEDIN", label: "LinkedIn", short: "in", colour: "#0A66C2", ink: "#fff", platforms: ["LINKEDIN"] },
  {
    id: "YOUTUBE_SHORTS",
    label: "YouTube Shorts",
    short: "Shorts",
    colour: "#E11D2E",
    ink: "#fff",
    platforms: ["YOUTUBE_SHORTS"],
  },
];

export function channelsFor(platforms: PlatformId[]) {
  return CHANNELS.filter((channel) => channel.platforms.some((id) => platforms.includes(id)));
}

export function platformLabel(id: PlatformId) {
  return PLATFORMS.find((item) => item.id === id)?.label ?? id;
}

export function platformColour(id: PlatformId) {
  return PLATFORMS.find((item) => item.id === id)?.colour ?? "#1E1A1C";
}

export function contentLabel(id: ContentTypeId) {
  return CONTENT_TYPES.find((item) => item.id === id)?.label ?? id;
}

export function statusLabel(id: StatusId) {
  return STATUSES.find((item) => item.id === id)?.label ?? id;
}
