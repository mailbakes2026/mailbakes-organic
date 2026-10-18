"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppTab } from "@/components/shell";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  PLATFORMS,
  STATUSES,
  STORY_PLATFORMS,
  contentLabel,
  platformColour,
  platformLabel,
  statusLabel,
} from "@/lib/constants";
import type {
  ContentTypeId,
  KeyDateDTO,
  PlatformId,
  PostDTO,
  StatusId,
  UserDTO,
} from "@/lib/types";

type ReviewAction = "approve" | "reject" | "request_changes";

function londonToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDays(iso, diff);
}

function formatDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatMonth(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

function monthCells(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function monthBounds(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

const COMMENT_LABEL = {
  APPROVAL: "Approved",
  REJECTION: "Rejected",
  CHANGES: "Changes requested",
  NOTE: "Note",
};

function statusPill(status: StatusId) {
  if (status === "APPROVED") return "pill ok";
  if (status === "REJECTED") return "pill hot";
  if (status === "PENDING_APPROVAL" || status === "CHANGES_REQUESTED") return "pill warn";
  return "pill";
}

export function Planner({
  user,
  posts,
  keyDates,
}: {
  user: UserDTO;
  posts: PostDTO[];
  keyDates: KeyDateDTO[];
}) {
  const router = useRouter();
  const { tab } = useAppTab();
  const [platform, setPlatform] = useState<PlatformId>("INSTAGRAM");
  const [showInReview, setShowInReview] = useState(true);
  const [postForm, setPostForm] = useState<PostDTO | "new" | null>(null);
  const [presetDate, setPresetDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<PostDTO | null>(null);
  const [story, setStory] = useState<{ items: PostDTO[]; index: number } | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<KeyDateDTO | null>(null);
  const [prompt, setPrompt] = useState<{ id: string; action: ReviewAction; comment: string } | null>(null);
  const [cursor, setCursor] = useState(londonToday);
  const [calView, setCalView] = useState<"month" | "week">("month");
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setCalView("week");
  }, []);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openPost = detail ? posts.find((post) => post.id === detail.id) ?? detail : null;

  function refresh() {
    router.refresh();
  }

  async function sendReview(id: string, action: ReviewAction, comment: string) {
    setBusy(true);
    setBanner(null);
    const response = await fetch(`/api/posts/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setBanner(data.error || "Couldn't update that post.");
      return;
    }
    setPrompt(null);
    refresh();
  }

  function askReview(id: string, action: ReviewAction) {
    if (action === "approve") {
      void sendReview(id, action, "");
      return;
    }
    setPrompt({ id, action, comment: "" });
  }

  async function removePost(id: string) {
    setBusy(true);
    const response = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setBanner(data.error || "Couldn't delete that post.");
      return;
    }
    setDetail(null);
    refresh();
  }

  async function removeKeyDate(id: string) {
    setBusy(true);
    const response = await fetch(`/api/key-dates/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      setBanner("Couldn't delete that date.");
      return;
    }
    setActiveKey(null);
    refresh();
  }

  const waiting = posts.filter((post) => post.status === "PENDING_APPROVAL");
  const changes = posts.filter((post) => post.status === "CHANGES_REQUESTED");
  const drafts = posts.filter((post) => post.status === "DRAFT");
  const approved = posts.filter((post) => post.status === "APPROVED");
  const rejected = posts.filter((post) => post.status === "REJECTED");

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Social media</h1>
          <p className="muted intro">
            Plan posts for Instagram, Facebook, TikTok, LinkedIn, YouTube Shorts and Snapchat.
            Management approves them here before anything is treated as ready. Approving doesn&apos;t
            publish anything.
          </p>
        </div>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => setKeyOpen(true)}>
            + Launch / key date
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPresetDate(null);
              setPostForm("new");
            }}
          >
            + New post
          </button>
        </div>
      </div>

      {banner ? <p className="alert crit">{banner}</p> : null}

      {tab === "approval" ? (
        <div>
          <section>
            {waiting.length === 0 ? (
              <p className="muted">Nothing waiting for approval.</p>
            ) : (
              waiting.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={user}
                  busy={busy}
                  onOpen={() => setDetail(post)}
                  onEdit={() => setPostForm(post)}
                  onReview={askReview}
                />
              ))
            )}
          </section>
          {changes.length > 0 ? (
            <Section title="Changes requested">
              {changes.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={user}
                  busy={busy}
                  onOpen={() => setDetail(post)}
                  onEdit={() => setPostForm(post)}
                  onReview={askReview}
                />
              ))}
            </Section>
          ) : null}
          {drafts.length > 0 ? (
            <Section title="Drafts">
              {drafts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={user}
                  busy={busy}
                  onOpen={() => setDetail(post)}
                  onEdit={() => setPostForm(post)}
                  onReview={askReview}
                />
              ))}
            </Section>
          ) : null}
          <details className="fold">
            <summary>
              Approved and scheduled posts
              <span className="pill">{approved.length}</span>
            </summary>
            {approved.length === 0 ? (
              <p className="muted">Nothing approved yet.</p>
            ) : (
              approved.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={user}
                  busy={busy}
                  onOpen={() => setDetail(post)}
                  onEdit={() => setPostForm(post)}
                  onReview={askReview}
                />
              ))
            )}
          </details>
          {rejected.length > 0 ? (
            <details className="fold">
              <summary>
                Rejected
                <span className="pill">{rejected.length}</span>
              </summary>
              {rejected.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={user}
                  busy={busy}
                  onOpen={() => setDetail(post)}
                  onEdit={() => setPostForm(post)}
                  onReview={askReview}
                />
              ))}
            </details>
          ) : null}
        </div>
      ) : null}

      {tab === "feed" ? (
        <Feed
          posts={posts}
          platform={platform}
          showInReview={showInReview}
          onPlatform={setPlatform}
          onToggleReview={setShowInReview}
          onOpen={setDetail}
          onStory={(items, index) => setStory({ items, index })}
        />
      ) : null}

      {tab === "calendar" ? (
        <Calendar
          posts={posts}
          keyDates={keyDates}
          cursor={cursor}
          view={calView}
          onCursor={setCursor}
          onView={setCalView}
          onOpenPost={setDetail}
          onOpenKey={setActiveKey}
          onCreate={(date) => {
            setPresetDate(date);
            setPostForm("new");
          }}
        />
      ) : null}

      <Dialog open={postForm !== null} onOpenChange={(open) => !open && setPostForm(null)}>
        <DialogContent showCloseButton={false} className="sheet-form">
          {postForm ? (
            <PostForm
              user={user}
              initial={postForm === "new" ? null : postForm}
              presetDate={presetDate}
              onClose={() => setPostForm(null)}
              onSaved={() => {
                setPostForm(null);
                refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={keyOpen} onOpenChange={setKeyOpen}>
        <DialogContent showCloseButton={false}>
          <KeyDateForm
            onClose={() => setKeyOpen(false)}
            onSaved={() => {
              setKeyOpen(false);
              refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(openPost)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent showCloseButton={false} className="sheet-form">
          {openPost ? (
            <PostDetail
              post={openPost}
              user={user}
              busy={busy}
              onClose={() => setDetail(null)}
              onEdit={() => {
                setPostForm(openPost);
                setDetail(null);
              }}
              onReview={askReview}
              onDelete={() => void removePost(openPost.id)}
              onPreview={() => setStory({ items: [openPost], index: 0 })}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(story)} onOpenChange={(open) => !open && setStory(null)}>
        <DialogContent showCloseButton={false} className="story-sheet">
          {story ? (
            <StoryViewer
              items={story.items}
              index={story.index}
              onIndex={(index) => setStory({ items: story.items, index })}
              onClose={() => setStory(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(prompt)} onOpenChange={(open) => !open && setPrompt(null)}>
        <DialogContent showCloseButton={false}>
          {prompt ? (
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                void sendReview(prompt.id, prompt.action, prompt.comment);
              }}
            >
              <DialogHeader>
                <DialogTitle>{prompt.action === "reject" ? "Reject post" : "Request changes"}</DialogTitle>
                <DialogDescription>
                  {prompt.action === "reject"
                    ? "Add a comment explaining the rejection. Nothing is published."
                    : "Tell the team what to change. Nothing is published."}
                </DialogDescription>
              </DialogHeader>
              <textarea
                rows={5}
                value={prompt.comment}
                onChange={(event) => setPrompt({ ...prompt, comment: event.target.value })}
                required
              />
              <div className="row">
                <button type="button" className="btn ghost" onClick={() => setPrompt(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={busy}>
                  {prompt.action === "reject" ? "Reject" : "Request changes"}
                </button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(activeKey)} onOpenChange={(open) => !open && setActiveKey(null)}>
        <DialogContent showCloseButton={false}>
          {activeKey ? (
            <div className="stack">
              <DialogHeader>
                <DialogTitle>{activeKey.title}</DialogTitle>
                <DialogDescription>
                  {activeKey.kind === "LAUNCH" ? "Launch" : "Key date"} · {formatDay(activeKey.date)}
                </DialogDescription>
              </DialogHeader>
              {activeKey.notes ? <p className="pre">{activeKey.notes}</p> : null}
              <div className="row">
                <DialogClose render={<button type="button" className="btn ghost" />}>Close</DialogClose>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={() => void removeKeyDate(activeKey.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function PostCard({
  post,
  user,
  busy,
  onOpen,
  onEdit,
  onReview,
}: {
  post: PostDTO;
  user: UserDTO;
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onReview: (id: string, action: ReviewAction) => void;
}) {
  const note = [...post.comments].reverse().find((comment) => comment.kind !== "APPROVAL");
  return (
    <article className="card">
      <button type="button" className="post-open" onClick={onOpen}>
        <div className="row">
          {post.platforms.map((item) => (
            <span key={item} className="plat">
              <span className="mark" style={{ background: platformColour(item) }} />
              {platformLabel(item)}
            </span>
          ))}
          <span className="pill">{contentLabel(post.contentType)}</span>
          <span className={statusPill(post.status)}>{statusLabel(post.status)}</span>
        </div>
        <h2>{post.title}</h2>
        <p className="muted clamp-2">{post.caption}</p>
        <p className="small muted">
          {post.authorName} · {formatDay(post.plannedDate)}
        </p>
      </button>
      {note ? (
        <p className="alert warn">
          <span>
            <b>{note.authorName}: </b>
            {note.body}
          </span>
        </p>
      ) : null}
      <div className="row">
        <ReviewButtons post={post} user={user} busy={busy} onEdit={onEdit} onReview={onReview} />
      </div>
    </article>
  );
}

function ReviewButtons({
  post,
  user,
  busy,
  onEdit,
  onReview,
}: {
  post: PostDTO;
  user: UserDTO;
  busy: boolean;
  onEdit: () => void;
  onReview: (id: string, action: ReviewAction) => void;
}) {
  if (user.role !== "MANAGEMENT") {
    return (
      <button type="button" className="btn ghost" onClick={onEdit}>
        Edit
      </button>
    );
  }
  return (
    <>
      {post.status !== "APPROVED" ? (
        <button type="button" className="btn" disabled={busy} onClick={() => onReview(post.id, "approve")}>
          Approve
        </button>
      ) : null}
      {post.status !== "CHANGES_REQUESTED" ? (
        <button type="button" className="btn ghost" onClick={() => onReview(post.id, "request_changes")}>
          Request changes
        </button>
      ) : null}
      {post.status !== "REJECTED" ? (
        <button type="button" className="btn danger" onClick={() => onReview(post.id, "reject")}>
          Reject
        </button>
      ) : null}
      <button type="button" className="btn ghost" onClick={onEdit}>
        Edit
      </button>
    </>
  );
}

function PostDetail({
  post,
  user,
  busy,
  onClose,
  onEdit,
  onReview,
  onDelete,
  onPreview,
}: {
  post: PostDTO;
  user: UserDTO;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onReview: (id: string, action: ReviewAction) => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const canDelete = user.role === "MANAGEMENT" || (post.authorId === user.id && post.status === "DRAFT");
  return (
    <div className="stack">
      <div className="sheet-head">
        <DialogHeader>
          <DialogTitle>{post.title}</DialogTitle>
          <DialogDescription>
            {contentLabel(post.contentType)} · {formatDay(post.plannedDate)} · {statusLabel(post.status)}
          </DialogDescription>
        </DialogHeader>
        <DialogClose render={<button type="button" className="btn ghost sm" />}>Close</DialogClose>
      </div>
      <div className="row">
        {post.platforms.map((item) => (
          <span key={item} className="plat">
            <span className="mark" style={{ background: platformColour(item) }} />
            {platformLabel(item)}
          </span>
        ))}
        <span className={statusPill(post.status)}>{statusLabel(post.status)}</span>
      </div>
      {post.contentType === "STORY" ? (
        <div>
          <StoryFrame post={post} />
          <button type="button" className="btn ghost" onClick={onPreview}>
            Open story preview
          </button>
        </div>
      ) : (
        <div className="media-stack">
          {post.media.map((media) =>
            media.mimeType.startsWith("video/") ? (
              <video key={media.id} src={`/api/media/${media.id}`} controls playsInline />
            ) : (
              <img key={media.id} src={`/api/media/${media.id}`} alt={post.title} />
            ),
          )}
        </div>
      )}
      <p className="pre">{post.caption}</p>
      {post.creativeNotes ? (
        <p className="muted pre">
          <b>Creative link or notes. </b>
          {post.creativeNotes}
        </p>
      ) : null}
      {post.comments.length > 0 ? (
        <ul className="notes">
          {post.comments.map((comment) => (
            <li key={comment.id}>
              <b>
                {comment.authorName} · {COMMENT_LABEL[comment.kind]} · {formatWhen(comment.createdAt)}
              </b>
              <p>{comment.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="row">
        <ReviewButtons post={post} user={user} busy={busy} onEdit={onEdit} onReview={onReview} />
        {canDelete ? (
          <button type="button" className="btn danger" disabled={busy} onClick={onDelete}>
            Delete
          </button>
        ) : null}
        <button type="button" className="btn ghost" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

function StoryFrame({ post }: { post: PostDTO }) {
  const media = post.media[0];
  return (
    <div className="story-frame">
      {media ? (
        media.mimeType.startsWith("video/") ? (
          <video src={`/api/media/${media.id}`} autoPlay muted playsInline loop />
        ) : (
          <img src={`/api/media/${media.id}`} alt="" />
        )
      ) : (
        <div className="story-empty" />
      )}
      <div className="story-bar">
        <i />
      </div>
      <div className="story-caption">
        <b>MailBakes</b>
        <p>{post.caption}</p>
      </div>
    </div>
  );
}

function StoryViewer({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: PostDTO[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const post = items[index];
  if (!post) return null;
  return (
    <div className="stack">
      <div className="sheet-head">
        <DialogHeader>
          <DialogTitle>{post.title}</DialogTitle>
          <DialogDescription>
            Story · {formatDay(post.plannedDate)} · {statusLabel(post.status)}
          </DialogDescription>
        </DialogHeader>
        <button type="button" className="btn ghost sm" onClick={onClose}>
          Close
        </button>
      </div>
      <StoryFrame post={post} />
      {items.length > 1 ? (
        <div className="row">
          <button type="button" className="btn ghost" disabled={index === 0} onClick={() => onIndex(index - 1)}>
            Previous
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={index === items.length - 1}
            onClick={() => onIndex(index + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

function visible(post: PostDTO, showInReview: boolean) {
  if (post.status === "APPROVED") return true;
  if (!showInReview) return false;
  return post.status === "PENDING_APPROVAL" || post.status === "CHANGES_REQUESTED";
}

function Feed({
  posts,
  platform,
  showInReview,
  onPlatform,
  onToggleReview,
  onOpen,
  onStory,
}: {
  posts: PostDTO[];
  platform: PlatformId;
  showInReview: boolean;
  onPlatform: (platform: PlatformId) => void;
  onToggleReview: (value: boolean) => void;
  onOpen: (post: PostDTO) => void;
  onStory: (items: PostDTO[], index: number) => void;
}) {
  const mine = posts
    .filter((post) => post.platforms.includes(platform) && visible(post, showInReview))
    .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate) || b.createdAt.localeCompare(a.createdAt));
  const stories = mine.filter((post) => post.contentType === "STORY");
  const feed = mine.filter((post) => post.contentType !== "STORY");
  const hasStories = STORY_PLATFORMS.includes(platform);
  const dark = platform === "TIKTOK" || platform === "YOUTUBE_SHORTS";

  return (
    <div className="feed-page">
      <div className="team-tabs" role="tablist">
        {PLATFORMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={platform === item.id ? "on" : ""}
            onClick={() => onPlatform(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="feed-tools">
        <p className="muted">How the feed will look — newest at the top. Tap a post to open it.</p>
        <label className="check-line">
          <input
            type="checkbox"
            checked={showInReview}
            onChange={(event) => onToggleReview(event.target.checked)}
          />
          Include posts still in review
        </label>
      </div>
      {hasStories ? (
        <div className="story-row">
          {stories.length === 0 ? (
            <p className="muted">No stories planned.</p>
          ) : (
            stories.map((post, index) => (
              <button key={post.id} type="button" className="story-bubble" onClick={() => onStory(stories, index)}>
                <span className={`story-ring${post.status === "APPROVED" ? "" : " waiting"}`}>
                  <span>
                    {post.media[0] ? <img src={`/api/media/${post.media[0].id}`} alt="" /> : null}
                  </span>
                </span>
                <small>{post.title}</small>
              </button>
            ))
          )}
        </div>
      ) : null}
      <div className={`feed-list${platform === "YOUTUBE_SHORTS" ? " shorts" : ""}`}>
        {feed.length === 0 ? (
          <p className="muted">No {platformLabel(platform)} posts planned yet.</p>
        ) : (
          feed.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => onOpen(post)}
              className={`feed-item${dark ? " dark" : ""}${platform === "SNAPCHAT" ? " snap" : ""}`}
            >
              <FeedMedia post={post} tall={post.contentType === "REEL" || dark} />
              <div className="feed-body">
                <p className="small muted">
                  MailBakes · {contentLabel(post.contentType)}
                  {post.status !== "APPROVED" ? ` · ${statusLabel(post.status)}` : ""}
                </p>
                <p>
                  <b>{post.title}</b>
                </p>
                <p className="clamp-3">{post.caption}</p>
                <p className="small muted">{formatDay(post.plannedDate)}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function FeedMedia({ post, tall }: { post: PostDTO; tall: boolean }) {
  const media = post.media[0];
  const shape = tall ? "tall" : "square";
  if (!media) return <div className={`media-fallback ${shape}`} />;
  if (media.mimeType.startsWith("video/")) {
    return <video src={`/api/media/${media.id}`} className={`feed-photo ${shape}`} muted playsInline />;
  }
  return <img src={`/api/media/${media.id}`} alt="" className={`feed-photo ${shape}`} />;
}

function Calendar({
  posts,
  keyDates,
  cursor,
  view,
  onCursor,
  onView,
  onOpenPost,
  onOpenKey,
  onCreate,
}: {
  posts: PostDTO[];
  keyDates: KeyDateDTO[];
  cursor: string;
  view: "month" | "week";
  onCursor: (iso: string) => void;
  onView: (view: "month" | "week") => void;
  onOpenPost: (post: PostDTO) => void;
  onOpenKey: (item: KeyDateDTO) => void;
  onCreate: (date: string) => void;
}) {
  const today = londonToday();
  const range = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor);
      return { start, end: addDays(start, 6), days: Array.from({ length: 7 }, (_, index) => addDays(start, index)) };
    }
    const bounds = monthBounds(cursor);
    return { ...bounds, days: monthCells(cursor) };
  }, [cursor, view]);

  const inView = (iso: string) => iso >= range.start && iso <= range.end;
  const visiblePosts = posts.filter((post) => post.status !== "REJECTED" && inView(post.plannedDate));
  const visibleDates = keyDates.filter((item) => inView(item.date));

  function shift(direction: number) {
    if (view === "week") onCursor(addDays(cursor, direction * 7));
    else {
      const [year, month] = cursor.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1 + direction, 1));
      onCursor(date.toISOString().slice(0, 10));
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => shift(-1)} aria-label="Previous">
            ‹
          </button>
          <button type="button" className="btn ghost" onClick={() => onCursor(today)}>
            Today
          </button>
          <button type="button" className="btn ghost" onClick={() => shift(1)} aria-label="Next">
            ›
          </button>
          <h2>{view === "month" ? formatMonth(cursor) : `${formatDay(range.start)} – ${formatDay(range.end)}`}</h2>
        </div>
        <div className="view-toggle">
          <button type="button" className={view === "week" ? "on" : ""} onClick={() => onView("week")}>
            Week
          </button>
          <button type="button" className={view === "month" ? "on" : ""} onClick={() => onView("month")}>
            Month
          </button>
        </div>
      </div>

      <div className="kpi-row">
        {PLATFORMS.map((item) => (
          <CountCard
            key={item.id}
            value={visiblePosts.filter((post) => post.platforms.includes(item.id)).length}
            label={item.label}
          />
        ))}
        <CountCard value={visiblePosts.filter((post) => post.status === "APPROVED").length} label="Approved" tone="green" />
        <CountCard
          value={visiblePosts.filter((post) => post.status === "PENDING_APPROVAL").length}
          label="Waiting for approval"
          tone="orange"
        />
        <CountCard value={visibleDates.length} label="Launches & key dates" />
      </div>

      <div className="legend">
        {PLATFORMS.map((item) => (
          <span key={item.id}>
            <span className="key" style={{ background: item.colour, borderColor: item.colour }} />
            {item.label}
          </span>
        ))}
        <span>
          <span className="key launch" /> Launch
        </span>
        <span>
          <span className="key event" /> Key date
        </span>
        <span>✓ approved</span>
        <span>○ waiting (dashed)</span>
      </div>

      <div>
        <div className="cal-head">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="cal-dow">
              {day}
            </div>
          ))}
        </div>
        <div className={`cal${view === "week" ? " cal-week" : ""}`}>
          {range.days.map((day) => {
            const outside = view === "month" && day.slice(0, 7) !== range.start.slice(0, 7);
            const dayPosts = posts.filter((post) => post.plannedDate === day && post.status !== "REJECTED");
            const dayKeys = keyDates.filter((item) => item.date === day);
            return (
              <div
                key={day}
                className={`cal-cell${day === today ? " today" : ""}${outside ? " closed" : ""}`}
              >
                <button type="button" className="cal-date" onClick={() => onCreate(day)}>
                  <span>{Number(day.slice(8))}</span>
                </button>
                {dayKeys.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`cal-chip ${item.kind === "LAUNCH" ? "launch" : "keydate"}`}
                    onClick={() => onOpenKey(item)}
                  >
                    <span className="grow">{item.title}</span>
                  </button>
                ))}
                {dayPosts.slice(0, 3).map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    className={`cal-chip ${post.status === "APPROVED" ? "approved" : "waiting"}`}
                    onClick={() => onOpenPost(post)}
                  >
                    <span className="mark" style={{ background: platformColour(post.platforms[0]) }} />
                    <span className="grow">
                      {post.contentType === "STORY" ? "Story · " : ""}
                      {post.title}
                    </span>
                  </button>
                ))}
                {dayPosts.length > 3 ? <p className="small muted">+{dayPosts.length - 3}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CountCard({ value, label, tone }: { value: number; label: string; tone?: "green" | "orange" }) {
  return (
    <div className={`kpi${tone ? ` ${tone}` : ""}`}>
      <div className="eyebrow">{label}</div>
      <div className="kpi-figure">{value}</div>
    </div>
  );
}

function PostForm({
  user,
  initial,
  presetDate,
  onClose,
  onSaved,
}: {
  user: UserDTO;
  initial: PostDTO | null;
  presetDate: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [platforms, setPlatforms] = useState<PlatformId[]>(initial?.platforms ?? ["INSTAGRAM"]);
  const [contentType, setContentType] = useState<ContentTypeId>(initial?.contentType ?? "FEED");
  const [plannedDate, setPlannedDate] = useState(initial?.plannedDate ?? presetDate ?? londonToday());
  const [status, setStatus] = useState<StatusId>(
    initial?.status === "APPROVED" && user.role === "TEAM" ? "PENDING_APPROVAL" : initial?.status ?? "PENDING_APPROVAL",
  );
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [notes, setNotes] = useState(initial?.creativeNotes ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [removeIds, setRemoveIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const statusOptions = STATUSES.filter((item) => {
    if (user.role === "MANAGEMENT") return true;
    if (item.id === "DRAFT" || item.id === "PENDING_APPROVAL") return true;
    return item.id === "CHANGES_REQUESTED" && initial?.status === "CHANGES_REQUESTED";
  });

  function togglePlatform(id: PlatformId) {
    setPlatforms((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const tooBig = files.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (tooBig) {
      setError(`${tooBig.name} is over 10MB. For a longer video, put a link in the notes.`);
      return;
    }
    setSaving(true);
    setError(null);
    const body = new FormData();
    body.set("title", title);
    body.set("platforms", JSON.stringify(platforms));
    body.set("contentType", contentType);
    body.set("plannedDate", plannedDate);
    body.set("status", status);
    body.set("caption", caption);
    body.set("creativeNotes", notes);
    body.set("removeMediaIds", JSON.stringify(removeIds));
    for (const file of files) body.append("media", file);
    const response = await fetch(initial ? `/api/posts/${initial.id}` : "/api/posts", {
      method: initial ? "PATCH" : "POST",
      body,
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Couldn't save that post.");
      return;
    }
    onSaved();
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="sheet-head">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit social post" : "New social post"}</DialogTitle>
          <DialogDescription>Saving a post only adds it to the plan. It is not published.</DialogDescription>
        </DialogHeader>
        <button type="button" className="btn ghost sm" onClick={onClose}>
          Close
        </button>
      </div>
      <label className="field" htmlFor="title">
        Post title *
        <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      </label>
      <div className="grid">
        <label className="field" htmlFor="type">
          Content type *
          <select
            id="type"
            value={contentType}
            onChange={(event) => {
              const next = event.target.value as ContentTypeId;
              setContentType(next);
              if (next === "STORY") {
                setPlatforms((current) => current.filter((item) => STORY_PLATFORMS.includes(item)));
              }
            }}
          >
            {CONTENT_TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="date">
          Planned post date *
          <input id="date" type="date" required value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} />
        </label>
      </div>
      <div className="field">
        Platforms *
        <div className="supplier-pick">
          {PLATFORMS.map((item) => {
            const disabled = contentType === "STORY" && !STORY_PLATFORMS.includes(item.id);
            const selected = platforms.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                className={selected ? "on" : ""}
                onClick={() => togglePlatform(item.id)}
              >
                <span className="mark" style={{ background: item.colour }} /> {item.label}
              </button>
            );
          })}
        </div>
        {contentType === "STORY" ? (
          <p className="small muted">
            Stories are for Instagram, Facebook and Snapchat. They still need approval, and they show in the calendar.
          </p>
        ) : null}
      </div>
      <label className="field" htmlFor="status">
        Status *
        <select id="status" value={status} onChange={(event) => setStatus(event.target.value as StatusId)}>
          {statusOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field" htmlFor="caption">
        Caption / content *
        <textarea id="caption" required rows={5} value={caption} onChange={(event) => setCaption(event.target.value)} />
      </label>
      <label className="field" htmlFor="notes">
        Creative link or notes
        <textarea id="notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="field">
        <span>Photos & videos (up to 10MB each — for longer videos, put a link in the notes)</span>
        {initial?.media.map((media) =>
          removeIds.includes(media.id) ? null : (
            <div key={media.id} className="file-row">
              <span>{media.fileName}</span>
              <button type="button" className="subtle link-serious" onClick={() => setRemoveIds((current) => [...current, media.id])}>
                Remove
              </button>
            </div>
          ),
        )}
        {files.map((file) => (
          <div key={file.name + file.size} className="file-row">
            <span>{file.name}</span>
            <button type="button" className="subtle link-serious" onClick={() => setFiles((current) => current.filter((item) => item !== file))}>
              Remove
            </button>
          </div>
        ))}
        <label className="file-drop">
          + Add
          <input
            id="media"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            multiple
            className="sr-only"
            onChange={(event) => {
              const chosen = Array.from(event.target.files ?? []);
              setFiles((current) => [...current, ...chosen]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="row">
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function KeyDateForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(londonToday());
  const [kind, setKind] = useState<"LAUNCH" | "KEY_DATE">("LAUNCH");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const body = new FormData();
    body.set("title", title);
    body.set("date", date);
    body.set("kind", kind);
    body.set("notes", notes);
    const response = await fetch("/api/key-dates", { method: "POST", body });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Couldn't save that date.");
      return;
    }
    onSaved();
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="sheet-head">
        <DialogHeader>
          <DialogTitle>Launch / key date</DialogTitle>
          <DialogDescription>Shows on the content calendar. It is not a social post.</DialogDescription>
        </DialogHeader>
        <button type="button" className="btn ghost sm" onClick={onClose}>
          Close
        </button>
      </div>
      <label className="field" htmlFor="key-title">
        Title *
        <input id="key-title" required value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="field" htmlFor="key-date">
        Date *
        <input id="key-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <label className="field" htmlFor="key-kind">
        Type *
        <select id="key-kind" value={kind} onChange={(event) => setKind(event.target.value as "LAUNCH" | "KEY_DATE")}>
          <option value="LAUNCH">Launch</option>
          <option value="KEY_DATE">Key date</option>
        </select>
      </label>
      <label className="field" htmlFor="key-notes">
        Notes
        <textarea id="key-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <div className="row">
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
