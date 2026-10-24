"use client";

import { InstaGrid, TikTokGrid } from "@/components/insta-grid";
import { COLUMNS, approverMayAct, columnFor, onBoard, type BoardId, type ReviewAction } from "@/lib/pipeline";
import { contentLabel, platformColour, platformLabel, statusLabel } from "@/lib/constants";
import type { IgProfileDTO, PlatformId, PostDTO, StatusId, UserDTO } from "@/lib/types";

function statusClass(status: StatusId) {
  if (status === "APPROVED") return "pill ok";
  if (status === "REJECTED") return "pill hot";
  if (status === "DRAFT") return "pill";
  return "pill warn";
}

function formatWhen(date: string, time: string | null) {
  const [year, month, day] = date.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return time ? `${label} · ${time}` : label;
}

function bySchedule(a: PostDTO, b: PostDTO) {
  return (
    a.plannedDate.localeCompare(b.plannedDate) ||
    (a.plannedTime ?? "99:99").localeCompare(b.plannedTime ?? "99:99") ||
    a.createdAt.localeCompare(b.createdAt)
  );
}

export function ChannelBoard({
  board,
  user,
  posts,
  profile,
  busy,
  onOpen,
  onEdit,
  onReview,
  onAmend,
  onChanged,
}: {
  board: BoardId;
  user: UserDTO;
  posts: PostDTO[];
  profile: IgProfileDTO;
  busy: boolean;
  onOpen: (post: PostDTO) => void;
  onEdit: (post: PostDTO) => void;
  onReview: (id: string, action: ReviewAction) => void;
  onAmend: (id: string) => void;
  onChanged: () => void;
}) {
  const mine = posts.filter((post) => onBoard(post, board));
  const rejected = mine.filter((post) => post.status === "REJECTED");
  const feedPosts = posts.filter((post) => post.status !== "REJECTED");

  return (
    <div className="channel-layout">
      <div className="channel-board">
        <div className="board-scroll">
          <div className="board-cols">
            {COLUMNS.map((column) => {
              const items = mine.filter((post) => columnFor(post.status) === column.id).sort(bySchedule);
              return (
                <section key={column.id} className={`pipe-col pipe-${column.id}`} aria-label={column.label}>
                  <header className="col-head">
                    <div>
                      <h2>{column.label}</h2>
                      <p>{column.hint}</p>
                    </div>
                    <span className="pill">{items.length}</span>
                  </header>
                  {items.length === 0 ? <p className="empty">Nothing here</p> : null}
                  {items.map((post) => (
                    <PipeCard
                      key={post.id}
                      post={post}
                      user={user}
                      busy={busy}
                      onOpen={() => onOpen(post)}
                      onEdit={() => onEdit(post)}
                      onReview={onReview}
                      onAmend={onAmend}
                    />
                  ))}
                </section>
              );
            })}
          </div>
        </div>
        {rejected.length > 0 ? (
          <details className="fold">
            <summary>
              Rejected
              <span className="pill">{rejected.length}</span>
            </summary>
            {rejected.map((post) => (
              <PipeCard
                key={post.id}
                post={post}
                user={user}
                busy={busy}
                onOpen={() => onOpen(post)}
                onEdit={() => onEdit(post)}
                onReview={onReview}
                onAmend={onAmend}
              />
            ))}
          </details>
        ) : null}
      </div>
      <aside className="channel-feed" aria-label="Feed preview">
        {board === "meta-posts" ? (
          <InstaGrid posts={feedPosts} profile={profile} onOpen={onOpen} onChanged={onChanged} embedded />
        ) : null}
        {board === "tiktok" ? <TikTokGrid posts={feedPosts} profile={profile} onOpen={onOpen} embedded /> : null}
        {board === "meta-stories" ? <StoryFeed posts={feedPosts} onOpen={onOpen} /> : null}
      </aside>
    </div>
  );
}

function PipeCard({
  post,
  user,
  busy,
  onOpen,
  onEdit,
  onReview,
  onAmend,
}: {
  post: PostDTO;
  user: UserDTO;
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onReview: (id: string, action: ReviewAction) => void;
  onAmend: (id: string) => void;
}) {
  const note = [...post.comments].reverse().find((comment) => comment.kind !== "APPROVAL");
  return (
    <article className="pipe-card">
      <button type="button" className="pipe-open" onClick={onOpen}>
        <span className="pipe-tags">
          {post.platforms.map((item) => (
            <span key={item} className="plat">
              <span className="mark" style={{ background: platformColour(item) }} />
              {platformLabel(item)}
            </span>
          ))}
        </span>
        <strong>{post.title}</strong>
        <span className="small muted">
          {contentLabel(post.contentType)} · {formatWhen(post.plannedDate, post.plannedTime)}
        </span>
        <span className={statusClass(post.status)}>{statusLabel(post.status)}</span>
        {note ? (
          <span className="pipe-note">
            {note.authorName}: {note.body}
          </span>
        ) : null}
      </button>
      <ReviewButtons post={post} user={user} busy={busy} compact onEdit={onEdit} onReview={onReview} onAmend={onAmend} />
    </article>
  );
}

export function ReviewButtons({
  post,
  user,
  busy,
  compact = false,
  onEdit,
  onReview,
  onAmend,
}: {
  post: PostDTO;
  user: UserDTO;
  busy: boolean;
  compact?: boolean;
  onEdit: () => void;
  onReview: (id: string, action: ReviewAction) => void;
  onAmend: (id: string) => void;
}) {
  const approve = approverMayAct(user.role, post.status, "approve");
  const changes = approverMayAct(user.role, post.status, "request_changes");
  const reject = !compact && approverMayAct(user.role, post.status, "reject");
  const amend = user.role === "TEAM" && post.status === "CHANGES_REQUESTED";
  return (
    <div className="row pipe-actions">
      {approve ? (
        <button type="button" className="btn sm" disabled={busy} onClick={() => onReview(post.id, "approve")}>
          Approve
        </button>
      ) : null}
      {changes ? (
        <button type="button" className="btn ghost sm" disabled={busy} onClick={() => onReview(post.id, "request_changes")}>
          Needs changes
        </button>
      ) : null}
      {amend ? (
        <button type="button" className="btn sm" disabled={busy} onClick={() => onAmend(post.id)}>
          Amendments made
        </button>
      ) : null}
      {reject ? (
        <button type="button" className="btn danger sm" disabled={busy} onClick={() => onReview(post.id, "reject")}>
          Reject
        </button>
      ) : null}
      <button type="button" className="btn ghost sm" onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

function StoryFeed({ posts, onOpen }: { posts: PostDTO[]; onOpen: (post: PostDTO) => void }) {
  const stories = posts
    .filter((post) => post.contentType === "STORY" && post.status !== "REJECTED")
    .sort(
      (a, b) =>
        b.plannedDate.localeCompare(a.plannedDate) ||
        (b.plannedTime ?? "").localeCompare(a.plannedTime ?? "") ||
        b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <div className="story-feed">
      <p className="muted small">Story frames, newest first. Tap one to open it.</p>
      {stories.length === 0 ? <p className="empty">No stories in this plan yet.</p> : null}
      <div className="story-rail">
        {stories.map((post) => {
          const media = post.media[0];
          return (
            <button key={post.id} type="button" className="story-rail-card" onClick={() => onOpen(post)}>
              <span className="story-rail-frame">
                {media ? (
                  media.mimeType.startsWith("video/") ? (
                    <video src={`/api/media/${media.id}#t=0.1`} muted playsInline preload="metadata" />
                  ) : (
                    <img src={`/api/media/${media.id}`} alt="" />
                  )
                ) : (
                  <span className="story-empty" />
                )}
                {post.media.length > 1 ? <span className="story-rail-count">{post.media.length}</span> : null}
              </span>
              <span className="story-rail-title">{post.title}</span>
              <span className="small muted">{post.platforms.map((item: PlatformId) => platformLabel(item)).join(" · ")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
