"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type Tab = "approval" | "feed" | "calendar";
type ReviewAction = "approve" | "reject" | "request_changes";

const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-white px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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
  const [tab, setTab] = useState<Tab>("approval");
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Social media</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Plan posts for Instagram, Facebook, TikTok, LinkedIn, YouTube Shorts and Snapchat.
            Management approves them here before anything is treated as ready. Approving doesn&apos;t
            publish anything.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-10 bg-white" onClick={() => setKeyOpen(true)}>
            + Launch / key date
          </Button>
          <Button
            type="button"
            className="h-10"
            onClick={() => {
              setPresetDate(null);
              setPostForm("new");
            }}
          >
            + New post
          </Button>
        </div>
      </div>

      <div className="mt-6 flex gap-6 overflow-x-auto border-b border-border">
        {(
          [
            ["approval", "Posts for approval"],
            ["feed", "Feed preview"],
            ["calendar", "Content calendar"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 border-b-2 pb-2 text-sm font-medium ${
              tab === id ? "border-[#1b3d32] text-[#17261f]" : "border-transparent text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {banner ? <p className="mt-4 rounded-lg bg-[#fdecee] px-3 py-2 text-sm text-[#9f2d3a]">{banner}</p> : null}

      {tab === "approval" ? (
        <div className="mt-5 space-y-6">
          <section>
            {waiting.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting for approval.</p>
            ) : (
              <div className="space-y-3">
                {waiting.map((post) => (
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
              </div>
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
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <span className="inline-block transition group-open:rotate-90">▶</span>
              Approved and scheduled posts
              <span className="text-muted-foreground">{approved.length}</span>
            </summary>
            <div className="mt-3 space-y-3">
              {approved.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing approved yet.</p>
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
            </div>
          </details>
          {rejected.length > 0 ? (
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <span className="inline-block transition group-open:rotate-90">▶</span>
                Rejected
                <span className="text-muted-foreground">{rejected.length}</span>
              </summary>
              <div className="mt-3 space-y-3">
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
              </div>
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
        <DialogContent showCloseButton={false} className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
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
        <DialogContent showCloseButton={false} className="sm:max-w-md">
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
        <DialogContent showCloseButton={false} className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
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
        <DialogContent showCloseButton={false} className="bg-[#111] text-white sm:max-w-sm">
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
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          {prompt ? (
            <form
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
              <Textarea
                className="mt-4 min-h-28 bg-white text-base"
                value={prompt.comment}
                onChange={(event) => setPrompt({ ...prompt, comment: event.target.value })}
                required
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-10 bg-white" onClick={() => setPrompt(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="h-10" disabled={busy}>
                  {prompt.action === "reject" ? "Reject" : "Request changes"}
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(activeKey)} onOpenChange={(open) => !open && setActiveKey(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          {activeKey ? (
            <div>
              <DialogHeader>
                <DialogTitle>{activeKey.title}</DialogTitle>
                <DialogDescription>
                  {activeKey.kind === "LAUNCH" ? "Launch" : "Key date"} · {formatDay(activeKey.date)}
                </DialogDescription>
              </DialogHeader>
              {activeKey.notes ? <p className="mt-3 text-sm">{activeKey.notes}</p> : null}
              <div className="mt-4 flex justify-end gap-2">
                <DialogClose render={<Button variant="outline" type="button" className="h-10 bg-white" />}>
                  Close
                </DialogClose>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-10"
                  disabled={busy}
                  onClick={() => void removeKeyDate(activeKey.id)}
                >
                  Delete
                </Button>
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
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
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
    <article className="rounded-xl border border-border bg-white p-4">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex flex-wrap items-center gap-2">
          {post.platforms.map((item) => (
            <span key={item} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: platformColour(item) }} />
              {platformLabel(item)}
            </span>
          ))}
          <span className="rounded-full bg-[#efeae1] px-2 py-0.5 text-xs">{contentLabel(post.contentType)}</span>
          <span className="text-xs text-muted-foreground">{statusLabel(post.status)}</span>
        </div>
        <h3 className="mt-2 font-semibold">{post.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.caption}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {post.authorName} · {formatDay(post.plannedDate)}
        </p>
      </button>
      {note ? (
        <p className="mt-2 rounded-lg bg-[#fff4e8] px-3 py-2 text-sm">
          <span className="font-medium">{note.authorName}: </span>
          {note.body}
        </p>
      ) : null}
      <div className="mt-3">
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
      <Button type="button" variant="outline" className="h-10 bg-white" onClick={onEdit}>
        Edit
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {post.status !== "APPROVED" ? (
        <Button type="button" className="h-10" disabled={busy} onClick={() => onReview(post.id, "approve")}>
          Approve
        </Button>
      ) : null}
      {post.status !== "CHANGES_REQUESTED" ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 bg-white"
          onClick={() => onReview(post.id, "request_changes")}
        >
          Request changes
        </Button>
      ) : null}
      {post.status !== "REJECTED" ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 bg-white text-destructive"
          onClick={() => onReview(post.id, "reject")}
        >
          Reject
        </Button>
      ) : null}
      <Button type="button" variant="ghost" className="h-10" onClick={onEdit}>
        Edit
      </Button>
    </div>
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
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <DialogHeader>
          <DialogTitle className="text-lg">{post.title}</DialogTitle>
          <DialogDescription>
            {contentLabel(post.contentType)} · {formatDay(post.plannedDate)} · {statusLabel(post.status)}
          </DialogDescription>
        </DialogHeader>
        <DialogClose render={<Button variant="outline" type="button" className="h-9 bg-white" />}>
          Close
        </DialogClose>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {post.platforms.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 text-xs">
            <span className="size-2 rounded-full" style={{ background: platformColour(item) }} />
            {platformLabel(item)}
          </span>
        ))}
      </div>
      {post.contentType === "STORY" ? (
        <div className="mb-4">
          <StoryFrame post={post} />
          <Button type="button" variant="outline" className="mt-3 h-10 bg-white" onClick={onPreview}>
            Open story preview
          </Button>
        </div>
      ) : (
        <div className="mb-4 grid gap-2">
          {post.media.map((media) =>
            media.mimeType.startsWith("video/") ? (
              <video key={media.id} src={`/api/media/${media.id}`} controls playsInline className="w-full rounded-lg" />
            ) : (
              <img key={media.id} src={`/api/media/${media.id}`} alt={post.title} className="w-full rounded-lg" />
            ),
          )}
        </div>
      )}
      <p className="whitespace-pre-wrap text-sm">{post.caption}</p>
      {post.creativeNotes ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Creative link or notes. </span>
          {post.creativeNotes}
        </p>
      ) : null}
      {post.comments.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {post.comments.map((comment) => (
            <li key={comment.id} className="rounded-lg bg-[#f6f3ec] px-3 py-2 text-sm">
              <span className="font-medium">
                {comment.authorName} · {COMMENT_LABEL[comment.kind]} · {formatWhen(comment.createdAt)}
              </span>
              <p className="mt-1">{comment.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <ReviewButtons post={post} user={user} busy={busy} onEdit={onEdit} onReview={onReview} />
        {canDelete ? (
          <Button type="button" variant="ghost" className="h-10 text-destructive" disabled={busy} onClick={onDelete}>
            Delete
          </Button>
        ) : null}
        <Button type="button" variant="ghost" className="h-10 sm:ml-auto" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

function StoryFrame({ post }: { post: PostDTO }) {
  const media = post.media[0];
  return (
    <div className="relative mx-auto aspect-[9/16] w-[min(100%,280px)] overflow-hidden rounded-[28px] bg-black text-white">
      {media ? (
        media.mimeType.startsWith("video/") ? (
          <video
            src={`/api/media/${media.id}`}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
            loop
          />
        ) : (
          <img src={`/api/media/${media.id}`} alt="" className="h-full w-full object-cover" />
        )
      ) : (
        <div className="h-full w-full bg-gradient-to-b from-[#ed217a] to-[#1b3d32]" />
      )}
      <div className="absolute inset-x-3 top-3 h-1 rounded-full bg-white/30">
        <div className="h-full w-1/2 rounded-full bg-white" />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-16">
        <p className="text-sm font-semibold">MailBakes</p>
        <p className="mt-1 text-sm">{post.caption}</p>
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
    <div>
      <div className="mb-3 flex items-center justify-between">
        <DialogHeader>
          <DialogTitle className="text-white">{post.title}</DialogTitle>
          <DialogDescription className="text-white/70">
            Story · {formatDay(post.plannedDate)} · {statusLabel(post.status)}
          </DialogDescription>
        </DialogHeader>
        <Button type="button" variant="outline" className="h-9" onClick={onClose}>
          Close
        </Button>
      </div>
      <StoryFrame post={post} />
      {items.length > 1 ? (
        <div className="mt-3 flex justify-between">
          <Button type="button" variant="outline" className="h-10" disabled={index === 0} onClick={() => onIndex(index - 1)}>
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={index === items.length - 1}
            onClick={() => onIndex(index + 1)}
          >
            Next
          </Button>
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

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        {PLATFORMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPlatform(item.id)}
            className={`h-9 rounded-lg px-3 text-sm ${
              platform === item.id ? "bg-[#1b3d32] text-white" : "border border-border bg-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <p>How the feed will look — newest at the top. Tap a post to open it.</p>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showInReview}
            onChange={(event) => onToggleReview(event.target.checked)}
          />
          Include posts still in review
        </label>
      </div>
      {hasStories ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {stories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stories planned.</p>
          ) : (
            stories.map((post, index) => (
              <button key={post.id} type="button" onClick={() => onStory(stories, index)} className="w-16 shrink-0 text-center">
                <span
                  className={`mx-auto block size-14 rounded-full p-[2px] ${
                    post.status === "APPROVED" ? "bg-[#ed217a]" : "border-2 border-dashed border-[#ed217a]"
                  }`}
                >
                  <span className="block h-full w-full overflow-hidden rounded-full bg-white">
                    {post.media[0] ? (
                      <img src={`/api/media/${post.media[0].id}`} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                </span>
                <span className="mt-1 block truncate text-[11px]">{post.title}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
      <div className={`mt-4 ${platform === "YOUTUBE_SHORTS" ? "grid gap-3 sm:grid-cols-3" : "space-y-3"}`}>
        {feed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {platformLabel(platform)} posts planned yet.</p>
        ) : (
          feed.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => onOpen(post)}
              className={`w-full overflow-hidden rounded-xl border border-border text-left ${
                platform === "TIKTOK" || platform === "YOUTUBE_SHORTS" || platform === "SNAPCHAT"
                  ? "max-w-xs bg-[#111] text-white"
                  : "max-w-md bg-white"
              } ${platform === "SNAPCHAT" ? "bg-[#fff6cc] text-[#17261f]" : ""}`}
            >
              <FeedMedia post={post} tall={post.contentType === "REEL" || platform === "TIKTOK" || platform === "YOUTUBE_SHORTS"} />
              <div className="p-3">
                <p className="text-xs opacity-70">
                  MailBakes · {contentLabel(post.contentType)}
                  {post.status !== "APPROVED" ? ` · ${statusLabel(post.status)}` : ""}
                </p>
                <p className="mt-1 text-sm font-semibold">{post.title}</p>
                <p className="mt-1 line-clamp-3 text-sm">{post.caption}</p>
                <p className="mt-2 text-xs opacity-70">{formatDay(post.plannedDate)}</p>
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
  const className = tall ? "aspect-[9/16] w-full object-cover" : "aspect-square w-full object-cover";
  if (!media) return <div className={`${tall ? "aspect-[9/16]" : "aspect-square"} bg-[#ffe9f2]`} />;
  if (media.mimeType.startsWith("video/")) {
    return <video src={`/api/media/${media.id}`} className={className} muted playsInline />;
  }
  return <img src={`/api/media/${media.id}`} alt="" className={className} />;
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
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="h-10 bg-white" onClick={() => shift(-1)} aria-label="Previous">
          ‹
        </Button>
        <Button type="button" variant="outline" className="h-10 bg-white" onClick={() => onCursor(today)}>
          Today
        </Button>
        <Button type="button" variant="outline" className="h-10 bg-white" onClick={() => shift(1)} aria-label="Next">
          ›
        </Button>
        <h2 className="px-2 text-lg font-semibold">
          {view === "month" ? formatMonth(cursor) : `${formatDay(range.start)} – ${formatDay(range.end)}`}
        </h2>
        <div className="ml-auto flex rounded-lg border border-border bg-white p-0.5">
          <button
            type="button"
            className={`h-9 rounded-md px-3 text-sm ${view === "week" ? "bg-[#1b3d32] text-white" : ""}`}
            onClick={() => onView("week")}
          >
            Week
          </button>
          <button
            type="button"
            className={`h-9 rounded-md px-3 text-sm ${view === "month" ? "bg-[#1b3d32] text-white" : ""}`}
            onClick={() => onView("month")}
          >
            Month
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {PLATFORMS.map((item) => (
          <CountCard
            key={item.id}
            value={visiblePosts.filter((post) => post.platforms.includes(item.id)).length}
            label={item.label}
          />
        ))}
        <CountCard value={visiblePosts.filter((post) => post.status === "APPROVED").length} label="Approved" />
        <CountCard
          value={visiblePosts.filter((post) => post.status === "PENDING_APPROVAL").length}
          label="Waiting for approval"
        />
        <CountCard value={visibleDates.length} label="Launches & key dates" />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {PLATFORMS.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm" style={{ background: item.colour }} />
            {item.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-[#f3c1c7]" /> Launch
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-[#f6ddb0]" /> Key date
        </span>
        <span>✓ approved</span>
        <span>○ waiting (dashed)</span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className={`grid min-w-[720px] grid-cols-7 gap-px bg-[#e4dfd4] ${view === "week" ? "min-h-80" : ""}`}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="bg-[#f6f3ec] px-2 py-1 text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
          {range.days.map((day) => {
            const outside = view === "month" && day.slice(0, 7) !== range.start.slice(0, 7);
            const dayPosts = posts.filter((post) => post.plannedDate === day && post.status !== "REJECTED");
            const dayKeys = keyDates.filter((item) => item.date === day);
            return (
              <div
                key={day}
                className={`min-h-28 bg-white p-1 ${day === today ? "ring-2 ring-inset ring-[#1b3d32]" : ""} ${
                  outside ? "bg-[#fbfaf6]" : ""
                }`}
              >
                <button type="button" onClick={() => onCreate(day)} className="px-1 text-xs text-muted-foreground">
                  {Number(day.slice(8))}
                </button>
                <div className="space-y-1">
                  {dayKeys.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenKey(item)}
                      className={`block w-full truncate rounded px-1 text-left text-[11px] ${
                        item.kind === "LAUNCH" ? "bg-[#fde8ea] text-[#9f2d3a]" : "bg-[#fff1d6] text-[#8a5a10]"
                      }`}
                    >
                      {item.title}
                    </button>
                  ))}
                  {dayPosts.slice(0, 3).map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => onOpenPost(post)}
                      className={`flex w-full items-center gap-1 truncate rounded border px-1 text-left text-[11px] ${
                        post.status === "APPROVED" ? "border-[#1b3d32]/30" : "border-dashed border-[#1b3d32]/50"
                      }`}
                    >
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: platformColour(post.platforms[0]) }} />
                      <span className="truncate">
                        {post.contentType === "STORY" ? "Story · " : ""}
                        {post.title}
                      </span>
                    </button>
                  ))}
                  {dayPosts.length > 3 ? (
                    <p className="px-1 text-[11px] text-muted-foreground">+{dayPosts.length - 3}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CountCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-32 shrink-0 rounded-xl border border-border bg-white px-3 py-2">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
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
    <form onSubmit={onSubmit}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit social post" : "New social post"}</DialogTitle>
          <DialogDescription>Saving a post only adds it to the plan. It is not published.</DialogDescription>
        </DialogHeader>
        <Button type="button" variant="outline" className="h-9 bg-white" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="title">Post title *</Label>
          <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required className="h-11 bg-white" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">Content type *</Label>
          <select
            id="type"
            className={fieldClass}
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
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Planned post date *</Label>
          <Input
            id="date"
            type="date"
            required
            value={plannedDate}
            onChange={(event) => setPlannedDate(event.target.value)}
            className="h-11 bg-white"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Platforms *</Label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((item) => {
              const disabled = contentType === "STORY" && !STORY_PLATFORMS.includes(item.id);
              const selected = platforms.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => togglePlatform(item.id)}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm disabled:opacity-40 ${
                    selected ? "border-[#1b3d32] bg-[#1b3d32] text-white" : "border-border bg-white"
                  }`}
                >
                  <span className="size-2 rounded-full" style={{ background: item.colour }} />
                  {item.label}
                </button>
              );
            })}
          </div>
          {contentType === "STORY" ? (
            <p className="text-xs text-muted-foreground">
              Stories are for Instagram, Facebook and Snapchat. They still need approval, and they show in the calendar.
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="status">Status *</Label>
          <select id="status" className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value as StatusId)}>
            {statusOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="caption">Caption / content *</Label>
          <Textarea id="caption" required value={caption} onChange={(event) => setCaption(event.target.value)} className="min-h-28 bg-white text-base" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Creative link or notes</Label>
          <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20 bg-white text-base" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="media">Photos & videos (up to 10MB each — for longer videos, put a link in the notes)</Label>
          {initial?.media.map((media) =>
            removeIds.includes(media.id) ? null : (
              <div key={media.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="truncate">{media.fileName}</span>
                <button type="button" className="text-[#9f2d3a]" onClick={() => setRemoveIds((current) => [...current, media.id])}>
                  Remove
                </button>
              </div>
            ),
          )}
          {files.map((file) => (
            <div key={file.name + file.size} className="flex items-center justify-between text-sm">
              <span className="truncate">{file.name}</span>
              <button type="button" onClick={() => setFiles((current) => current.filter((item) => item !== file))}>
                Remove
              </button>
            </div>
          ))}
          <label className="flex h-20 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#cfc8ba] text-sm">
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
      </div>
      {error ? <p className="mt-3 text-sm text-[#9f2d3a]">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-10 bg-white" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="h-10" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
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
    <form onSubmit={onSubmit}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <DialogHeader>
          <DialogTitle>Launch / key date</DialogTitle>
          <DialogDescription>Shows on the content calendar. It is not a social post.</DialogDescription>
        </DialogHeader>
        <Button type="button" variant="outline" className="h-9 bg-white" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="key-title">Title *</Label>
          <Input id="key-title" required value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 bg-white" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="key-date">Date *</Label>
          <Input id="key-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="h-11 bg-white" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="key-kind">Type *</Label>
          <select id="key-kind" className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as "LAUNCH" | "KEY_DATE")}>
            <option value="LAUNCH">Launch</option>
            <option value="KEY_DATE">Key date</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="key-notes">Notes</Label>
          <Textarea id="key-notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20 bg-white text-base" />
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-[#9f2d3a]">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-10 bg-white" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="h-10" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
