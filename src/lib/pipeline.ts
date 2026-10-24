type Role = "MANAGEMENT" | "TEAM";
type StatusId = "DRAFT" | "PENDING_APPROVAL" | "CHANGES_REQUESTED" | "AMENDMENTS_MADE" | "APPROVED" | "REJECTED";
type PlatformId = "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "LINKEDIN" | "YOUTUBE_SHORTS" | "SNAPCHAT" | "PINTEREST";
type ContentTypeId = "FEED" | "REEL" | "STORY";

export type BoardId =
  | "meta-posts"
  | "meta-stories"
  | "tiktok"
  | "snapchat"
  | "linkedin"
  | "youtube"
  | "pinterest";

export type ColumnId = "approval" | "changes" | "amended" | "approved" | "declined";

export type ReviewAction = "approve" | "request_changes" | "reject";

export const COLUMNS: { id: ColumnId; label: string; hint: string }[] = [
  { id: "approval", label: "For approval", hint: "Waiting on Millie" },
  { id: "changes", label: "Needs changes", hint: "Manager to amend" },
  { id: "amended", label: "Amendments made", hint: "Back for approval" },
  { id: "approved", label: "Approved", hint: "Ready to post by hand" },
  { id: "declined", label: "Declined", hint: "Not going ahead" },
];

type CommentLike = { kind: string; body: string };

// A pending post that already went through "changes requested" is an amendment
// waiting for approval again, not a first-time submission.
export function migratedStatus(status: StatusId, comments: CommentLike[]): StatusId {
  if (status !== "PENDING_APPROVAL") return status;
  const round = comments.some(
    (comment) => comment.kind === "CHANGES" || comment.body === "Sent back for approval.",
  );
  return round ? "AMENDMENTS_MADE" : status;
}

export function columnFor(status: StatusId): ColumnId | null {
  if (status === "DRAFT" || status === "PENDING_APPROVAL") return "approval";
  if (status === "CHANGES_REQUESTED") return "changes";
  if (status === "AMENDMENTS_MADE") return "amended";
  if (status === "APPROVED") return "approved";
  if (status === "REJECTED") return "declined";
  return null;
}

export function awaitingApproval(status: StatusId) {
  return status === "PENDING_APPROVAL" || status === "AMENDMENTS_MADE";
}

// Millie can approve or ask for changes on every post that is waiting,
// including one that has already been through a round.
export function approverMayAct(role: Role, status: StatusId, action: ReviewAction) {
  if (role !== "MANAGEMENT") return false;
  if (action === "reject") return status !== "REJECTED";
  if (awaitingApproval(status)) return action === "approve" || action === "request_changes";
  if (action === "approve") return status === "CHANGES_REQUESTED";
  if (action === "request_changes") return status === "CHANGES_REQUESTED" || status === "APPROVED";
  return false;
}

// null means the team is not allowed to set that status.
export function statusAfterSave(role: Role, requested: StatusId, previous?: StatusId): StatusId | null {
  if (role !== "TEAM") {
    if (previous === "CHANGES_REQUESTED" && requested === "PENDING_APPROVAL") return "AMENDMENTS_MADE";
    return requested;
  }
  if (!previous) {
    if (requested === "DRAFT" || requested === "PENDING_APPROVAL") return requested;
    return null;
  }
  if (previous === "APPROVED" || previous === "CHANGES_REQUESTED" || previous === "AMENDMENTS_MADE") {
    if (requested === "DRAFT") return "DRAFT";
    return "AMENDMENTS_MADE";
  }
  if (requested === "DRAFT" || requested === "PENDING_APPROVAL") return requested;
  return null;
}

export function onBoard(
  post: { platforms: PlatformId[]; contentType: ContentTypeId },
  board: BoardId,
) {
  const meta = post.platforms.includes("INSTAGRAM") || post.platforms.includes("FACEBOOK");
  if (board === "meta-stories") return post.contentType === "STORY" && meta;
  if (board === "meta-posts") return post.contentType !== "STORY" && meta;
  if (board === "tiktok") return post.platforms.includes("TIKTOK");
  if (board === "snapchat") return post.platforms.includes("SNAPCHAT");
  if (board === "linkedin") return post.platforms.includes("LINKEDIN");
  if (board === "youtube") return post.platforms.includes("YOUTUBE_SHORTS");
  return post.platforms.includes("PINTEREST");
}
