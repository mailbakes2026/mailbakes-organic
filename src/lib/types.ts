export type Role = "MANAGEMENT" | "TEAM";

export type PlatformId =
  | "INSTAGRAM"
  | "FACEBOOK"
  | "TIKTOK"
  | "LINKEDIN"
  | "YOUTUBE_SHORTS"
  | "SNAPCHAT"
  | "PINTEREST";

export type ContentTypeId = "FEED" | "REEL" | "STORY";

export type StatusId =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "CHANGES_REQUESTED"
  | "AMENDMENTS_MADE"
  | "APPROVED"
  | "REJECTED";

export type CommentKindId = "APPROVAL" | "REJECTION" | "CHANGES" | "NOTE";

export type MediaDTO = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type StatSourceId = "MANUAL" | "API";

export type PostStatDTO = {
  platform: PlatformId;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  linkClicks: number | null;
  source: StatSourceId;
  syncedAt: string | null;
};

export type CommentDTO = {
  id: string;
  kind: CommentKindId;
  body: string;
  createdAt: string;
  authorName: string;
};

export type PostDTO = {
  id: string;
  title: string;
  platforms: PlatformId[];
  contentType: ContentTypeId;
  plannedDate: string;
  plannedTime: string | null;
  status: StatusId;
  caption: string;
  creativeNotes: string;
  authorId: string;
  authorName: string;
  reviewerName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  media: MediaDTO[];
  reelCover: MediaDTO | null;
  stats: PostStatDTO[];
  comments: CommentDTO[];
};

export type NoteStatusId = "IDEA" | "PLANNED" | "DONE";

export type NoteImageDTO = {
  id: string;
  fileName: string;
  mimeType: string;
};

export type NoteDTO = {
  id: string;
  title: string;
  description: string;
  links: string[];
  platform: PlatformId | null;
  allPlatforms: boolean;
  date: string | null;
  doThisWeek: boolean;
  status: NoteStatusId;
  checked: boolean;
  authorName: string;
  postId: string | null;
  images: NoteImageDTO[];
  createdAt: string;
  updatedAt: string;
};

export type KeyDateDTO = {
  id: string;
  title: string;
  date: string;
  kind: "LAUNCH" | "KEY_DATE";
  notes: string;
};

export type ConnectionStatus = "SETUP_NEEDED" | "DISCONNECTED" | "CONNECTED" | "NEEDS_RECONNECT";

export type ConnectionCardDTO = {
  id: string;
  slug: string;
  label: string;
  blurb: string;
  status: ConnectionStatus;
  accountName: string;
  lastSyncedAt: string | null;
  lastSyncError: string;
  missing: string[];
  storageReady: boolean;
  redirectUri: string;
  setup: string[];
};

export type OrganicPostDTO = {
  platform: PlatformId;
  externalId: string;
  title: string;
  publishedOn: string;
  matchedPostId: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  linkClicks: number | null;
};

export type OrganicDayDTO = {
  platform: PlatformId;
  day: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  linkClicks: number | null;
};

export type FollowerPointDTO = {
  platform: PlatformId;
  day: string;
  followers: number;
};

export type OrganicReportDTO = {
  posts: OrganicPostDTO[];
  followers: FollowerPointDTO[];
  days: OrganicDayDTO[];
};

export type UserDTO = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type IgHighlightDTO = {
  id: string;
  title: string;
  coverId: string | null;
};

export type IgProfileDTO = {
  handle: string;
  displayName: string;
  bio: string;
  link: string;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  avatarId: string | null;
  highlights: IgHighlightDTO[];
};
