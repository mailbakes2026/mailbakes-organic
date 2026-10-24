"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarBoard } from "@/components/calendar-board";
import { ChannelBoard, ReviewButtons } from "@/components/channel-board";
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
  MAX_FILES,
  MAX_UPLOAD_BYTES,
  PLATFORMS,
  STATUSES,
  STORY_PLATFORMS,
  contentLabel,
  platformColour,
  platformLabel,
  statusLabel,
} from "@/lib/constants";
import { approverMayAct, type BoardId, type ReviewAction } from "@/lib/pipeline";
import { PostStatsForm } from "@/components/post-stats";
import { NoteForm } from "@/components/notes-board";
import { MediaCarousel } from "@/components/media-carousel";
import type {
  ContentTypeId,
  IgProfileDTO,
  KeyDateDTO,
  NoteDTO,
  PlatformId,
  PostDTO,
  StatusId,
  UserDTO,
} from "@/lib/types";

function londonToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatSchedule(date: string, time: string | null) {
  return time ? `${formatDay(date)} at ${time}` : formatDay(date);
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

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));
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
  if (status === "AMENDMENTS_MADE") return "pill";
  if (status === "PENDING_APPROVAL" || status === "CHANGES_REQUESTED") return "pill warn";
  return "pill";
}

const BOARD_COPY: Record<BoardId, { title: string; blurb: string }> = {
  "meta-posts": {
    title: "Meta posts",
    blurb: "Instagram and Facebook feed posts and reels. The grid beside the board is how the feed will look.",
  },
  "meta-stories": {
    title: "Meta stories",
    blurb: "Story frames for Instagram and Facebook. Approving does not publish anything.",
  },
  tiktok: {
    title: "TikTok",
    blurb: "TikToks move through the same approval columns. The grid beside the board is the TikTok preview.",
  },
};

export function Planner({
  user,
  posts,
  keyDates,
  profile,
  notes,
}: {
  user: UserDTO;
  posts: PostDTO[];
  keyDates: KeyDateDTO[];
  profile: IgProfileDTO;
  notes: NoteDTO[];
}) {
  const router = useRouter();
  const { tab } = useAppTab();
  const [postForm, setPostForm] = useState<PostDTO | "new" | null>(null);
  const [noteForm, setNoteForm] = useState<NoteDTO | "new" | null>(null);
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

  async function amend(id: string) {
    setBusy(true);
    setBanner(null);
    const response = await fetch(`/api/posts/${id}/amend`, { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setBanner(data.error || "Couldn't send that back for approval.");
      return;
    }
    refresh();
  }

  function askReview(id: string, action: ReviewAction) {
    const post = posts.find((item) => item.id === id);
    if (!post || !approverMayAct(user.role, post.status, action)) {
      setBanner("This post isn't waiting for approval.");
      return;
    }
    setDetail(post);
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

  const board: BoardId | null = tab === "calendar" ? null : tab;
  const copy = board ? BOARD_COPY[board] : null;

  return (
    <div className="planner">
      {copy ? (
        <div className="page-head">
          <div>
            <h1>{copy.title}</h1>
            <p className="muted intro">{copy.blurb}</p>
          </div>
          <div className="row">
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
      ) : (
        <div className="page-head">
          <div>
            <h1>Content calendar</h1>
            <p className="muted intro">Posts are coloured by channel and status. Click one to open it.</p>
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
      )}

      {banner ? <p className="alert crit">{banner}</p> : null}

      {board ? (
        <ChannelBoard
          board={board}
          user={user}
          posts={posts}
          profile={profile}
          busy={busy}
          onOpen={setDetail}
          onEdit={setPostForm}
          onReview={askReview}
          onAmend={(id) => void amend(id)}
          onChanged={refresh}
        />
      ) : (
        <CalendarBoard
          posts={posts}
          notes={notes}
          keyDates={keyDates}
          cursor={cursor}
          view={calView}
          onCursor={setCursor}
          onView={setCalView}
          onOpenPost={setDetail}
          onOpenKey={setActiveKey}
          onCreatePost={(date) => {
            setPresetDate(date);
            setPostForm("new");
          }}
          onEditNote={setNoteForm}
          onChanged={refresh}
        />
      )}

      <Dialog open={noteForm !== null} onOpenChange={(open) => !open && setNoteForm(null)}>
        <DialogContent showCloseButton={false} className="sheet-form">
          {noteForm ? (
            <div className="stack">
              <DialogHeader>
                <DialogTitle>{noteForm === "new" ? "New note" : "Edit note"}</DialogTitle>
                <DialogDescription>
                  Ideas and inspo. A date puts this note on the content calendar.
                </DialogDescription>
              </DialogHeader>
              <NoteForm
                initial={noteForm === "new" ? null : noteForm}
                onClose={() => setNoteForm(null)}
                onSaved={() => {
                  setNoteForm(null);
                  refresh();
                }}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={postForm !== null} onOpenChange={(open) => !open && setPostForm(null)}>
        <DialogContent showCloseButton={false} className="sheet-form">
          {postForm ? (
            <PostForm
              user={user}
              initial={postForm === "new" ? null : postForm}
              presetDate={presetDate}
              board={board}
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
              onAmend={(id) => void amend(id)}
              onDelete={() => void removePost(openPost.id)}
              prompt={prompt && prompt.id === openPost.id ? prompt : null}
              onPromptComment={(comment) => setPrompt((current) => (current ? { ...current, comment } : current))}
              onSubmitPrompt={() => {
                if (prompt) void sendReview(prompt.id, prompt.action, prompt.comment);
              }}
              onCancelPrompt={() => setPrompt(null)}
              onPreview={() => setStory({ items: [openPost], index: 0 })}
              onChanged={refresh}
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


function PostDetail({
  post,
  user,
  busy,
  onClose,
  onEdit,
  onReview,
  onAmend,
  onDelete,
  onPreview,
  onChanged,
  prompt,
  onPromptComment,
  onSubmitPrompt,
  onCancelPrompt,
}: {
  post: PostDTO;
  user: UserDTO;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onReview: (id: string, action: ReviewAction) => void;
  onAmend: (id: string) => void;
  onDelete: () => void;
  onPreview: () => void;
  onChanged: () => void;
  prompt: { action: ReviewAction; comment: string } | null;
  onPromptComment: (comment: string) => void;
  onSubmitPrompt: () => void;
  onCancelPrompt: () => void;
}) {
  const canDelete = user.role === "MANAGEMENT" || (post.authorId === user.id && post.status === "DRAFT");
  return (
    <div className="stack">
      <div className="sheet-head">
        <DialogHeader>
          <DialogTitle>{post.title}</DialogTitle>
          <DialogDescription>
            {contentLabel(post.contentType)} · {formatSchedule(post.plannedDate, post.plannedTime)} · {statusLabel(post.status)}
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
      {post.contentType === "REEL" && post.reelCover ? (
        <figure className="reel-cover-detail">
          <img src={`/api/media/${post.reelCover.id}`} alt="Reel cover" />
          <figcaption className="small muted">Reel cover</figcaption>
        </figure>
      ) : null}
      {post.contentType === "STORY" ? (
        <div>
          <StoryPreview post={post} />
          <button type="button" className="btn ghost" onClick={onPreview}>
            Open story preview
          </button>
        </div>
      ) : (
        <MediaCarousel items={post.media} title={post.title} />
      )}
      <p className="pre">{post.caption}</p>
      {post.creativeNotes ? (
        <p className="muted pre">
          <b>Creative link or notes. </b>
          {post.creativeNotes}
        </p>
      ) : null}
      <section>
        <h3>Performance</h3>
        <PostStatsForm key={post.stats.map((stat) => `${stat.platform}:${stat.views ?? ""}:${stat.likes ?? ""}`).join("|")} post={post} onSaved={onChanged} />
      </section>
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
      {prompt ? (
        <form
          className="stack review-bar"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitPrompt();
          }}
        >
          <label className="field" htmlFor="review-comment">
            {prompt.action === "reject" ? "Why is this rejected?" : "What needs to change?"}
            <textarea
              id="review-comment"
              rows={4}
              value={prompt.comment}
              onChange={(event) => onPromptComment(event.target.value)}
              required
            />
          </label>
          <div className="row">
            <button type="button" className="btn ghost" onClick={onCancelPrompt}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={busy}>
              {prompt.action === "reject" ? "Reject" : "Needs changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className="review-bar">
          <ReviewButtons post={post} user={user} busy={busy} onEdit={onEdit} onReview={onReview} onAmend={onAmend} />
          <div className="row">
            {canDelete ? (
              <button type="button" className="btn danger sm" disabled={busy} onClick={onDelete}>
                Delete
              </button>
            ) : null}
            <button type="button" className="btn ghost sm" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StoryStage({
  post,
  frame,
  onFrame,
}: {
  post: PostDTO;
  frame: number;
  onFrame: (next: number) => void;
}) {
  const startX = useRef<number | null>(null);
  const count = Math.max(post.media.length, 1);
  const safe = Math.min(Math.max(frame, 0), count - 1);
  const media = post.media[safe];
  return (
    <div
      className="story-frame"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("video, button")) return;
        startX.current = event.clientX;
      }}
      onPointerUp={(event) => {
        if (startX.current == null) return;
        const dx = event.clientX - startX.current;
        startX.current = null;
        if (dx > 40) onFrame(safe - 1);
        else if (dx < -40) onFrame(safe + 1);
      }}
    >
      {media ? (
        media.mimeType.startsWith("video/") ? (
          <video key={media.id} src={`/api/media/${media.id}`} autoPlay muted playsInline loop />
        ) : (
          <img key={media.id} src={`/api/media/${media.id}`} alt="" />
        )
      ) : (
        <div className="story-empty" />
      )}
      <div className="story-progress" aria-hidden="true">
        {Array.from({ length: count }, (_, segment) => (
          <i key={segment} className={segment < safe ? "done" : segment === safe ? "on" : ""} />
        ))}
      </div>
      {post.media.length > 1 ? (
        <>
          <button type="button" className="story-hit left" aria-label="Previous frame" onClick={() => onFrame(safe - 1)} />
          <button type="button" className="story-hit right" aria-label="Next frame" onClick={() => onFrame(safe + 1)} />
        </>
      ) : null}
      <div className="story-caption">
        <b>MailBakes</b>
        <p>{post.caption}</p>
      </div>
    </div>
  );
}

function StoryPreview({ post }: { post: PostDTO }) {
  const [frame, setFrame] = useState(0);
  const count = Math.max(post.media.length, 1);
  return (
    <StoryStage
      post={post}
      frame={Math.min(frame, count - 1)}
      onFrame={(next) => setFrame(Math.max(0, Math.min(count - 1, next)))}
    />
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
  const [frame, setFrame] = useState(0);
  const landOnEnd = useRef(false);
  useEffect(() => {
    const count = Math.max(post?.media.length ?? 1, 1);
    if (landOnEnd.current) {
      landOnEnd.current = false;
      setFrame(count - 1);
    } else {
      setFrame(0);
    }
  }, [index, post]);
  if (!post) return null;
  const count = Math.max(post.media.length, 1);

  function onFrame(next: number) {
    if (next >= count) {
      if (index < items.length - 1) onIndex(index + 1);
      return;
    }
    if (next < 0) {
      if (index > 0) {
        landOnEnd.current = true;
        onIndex(index - 1);
      }
      return;
    }
    setFrame(next);
  }

  return (
    <div className="stack">
      <div className="sheet-head">
        <DialogHeader>
          <DialogTitle>{post.title}</DialogTitle>
          <DialogDescription>
            Story · {formatSchedule(post.plannedDate, post.plannedTime)} · {statusLabel(post.status)}
            {post.media.length > 1 ? ` · frame ${Math.min(frame, count - 1) + 1} of ${post.media.length}` : ""}
          </DialogDescription>
        </DialogHeader>
        <button type="button" className="btn ghost sm" onClick={onClose}>
          Close
        </button>
      </div>
      <StoryStage post={post} frame={frame} onFrame={onFrame} />
      {items.length > 1 || post.media.length > 1 ? (
        <div className="row">
          <button type="button" className="btn ghost" disabled={index === 0 && frame === 0} onClick={() => onFrame(frame - 1)}>
            Previous
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={index === items.length - 1 && frame >= count - 1}
            onClick={() => onFrame(frame + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}


type MediaSlot =
  | { key: string; kind: "saved"; id: string; name: string }
  | { key: string; kind: "file"; file: File };

function PostForm({
  user,
  initial,
  presetDate,
  board,
  onClose,
  onSaved,
}: {
  user: UserDTO;
  initial: PostDTO | null;
  presetDate: string | null;
  board: BoardId | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const preset =
    board === "meta-stories"
      ? { contentType: "STORY" as const, platforms: ["INSTAGRAM" as const] }
      : board === "tiktok"
        ? { contentType: "REEL" as const, platforms: ["TIKTOK" as const] }
        : { contentType: "FEED" as const, platforms: ["INSTAGRAM" as const] };
  const [title, setTitle] = useState(initial?.title ?? "");
  const [platforms, setPlatforms] = useState<PlatformId[]>(initial?.platforms ?? [...preset.platforms]);
  const [contentType, setContentType] = useState<ContentTypeId>(initial?.contentType ?? preset.contentType);
  const [plannedDate, setPlannedDate] = useState(initial?.plannedDate ?? presetDate ?? londonToday());
  const [plannedTime, setPlannedTime] = useState(initial?.plannedTime ?? "12:00");
  const [status, setStatus] = useState<StatusId>(
    !initial
      ? "PENDING_APPROVAL"
      : user.role === "TEAM" && (initial.status === "APPROVED" || initial.status === "CHANGES_REQUESTED")
        ? "AMENDMENTS_MADE"
        : initial.status,
  );
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [notes, setNotes] = useState(initial?.creativeNotes ?? "");
  const [slots, setSlots] = useState<MediaSlot[]>(() =>
    (initial?.media ?? []).map((media) => ({ key: media.id, kind: "saved" as const, id: media.id, name: media.fileName })),
  );
  const slotSeq = useRef(0);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const statusOptions = STATUSES.filter((item) => {
    if (user.role === "MANAGEMENT") return true;
    if (initial && (initial.status === "CHANGES_REQUESTED" || initial.status === "AMENDMENTS_MADE" || initial.status === "APPROVED")) {
      return item.id === "DRAFT" || item.id === "AMENDMENTS_MADE";
    }
    return item.id === "DRAFT" || item.id === "PENDING_APPROVAL";
  });

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  function moveSlot(index: number, delta: number) {
    setSlots((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function togglePlatform(id: PlatformId) {
    setPlatforms((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const newFiles = slots.flatMap((slot) => (slot.kind === "file" ? [slot.file] : []));
    const tooBig = [...newFiles, coverFile].find((file) => file && file.size > MAX_UPLOAD_BYTES);
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
    body.set("plannedTime", plannedTime);
    body.set("status", status);
    body.set("caption", caption);
    body.set("creativeNotes", notes);
    const kept = new Set(slots.flatMap((slot) => (slot.kind === "saved" ? [slot.id] : [])));
    body.set(
      "removeMediaIds",
      JSON.stringify((initial?.media ?? []).map((media) => media.id).filter((id) => !kept.has(id))),
    );
    body.set(
      "mediaOrder",
      JSON.stringify(
        slots.map((slot) => (slot.kind === "saved" ? `id:${slot.id}` : `new:${newFiles.indexOf(slot.file)}`)),
      ),
    );
    if (contentType === "REEL" && coverFile) body.set("reelCover", coverFile);
    else if (contentType === "REEL" && removeCover) body.set("removeReelCover", "true");
    for (const file of newFiles) body.append("media", file);
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
        <label className="field" htmlFor="time">
          Posting time *
          <input
            id="time"
            type="time"
            required
            step={60}
            value={plannedTime}
            onChange={(event) => setPlannedTime(event.target.value)}
          />
          <p className="small muted">Europe/London. New posts start at 12:00.</p>
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
      {contentType === "REEL" ? (
        <div className="field">
          <span>Reel cover</span>
          <p className="small muted">1080x1920, cropped to 3:4 on the grid.</p>
          {initial?.reelCover && !removeCover && !coverFile ? (
            <div className="file-row">
              <img className="reel-cover-card" src={`/api/media/${initial.reelCover.id}`} alt="" />
              <span>{initial.reelCover.fileName}</span>
              <button type="button" className="subtle link-serious" onClick={() => setRemoveCover(true)}>
                Remove
              </button>
            </div>
          ) : null}
          {coverFile ? (
            <div className="file-row">
              {coverPreview ? <img className="reel-cover-card" src={coverPreview} alt="" /> : null}
              <span>{coverFile.name}</span>
              <button type="button" className="subtle link-serious" onClick={() => setCoverFile(null)}>
                Remove
              </button>
            </div>
          ) : null}
          <label className="file-drop">
            {coverFile || (initial?.reelCover && !removeCover) ? "Replace cover" : "+ Add cover"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => {
                setCoverFile(event.target.files?.[0] ?? null);
                setRemoveCover(false);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      ) : null}
      <div className="field">
        <span>Photos & videos (up to 10MB each — for longer videos, put a link in the notes)</span>
        {contentType === "FEED" ? (
          <p className="small muted">Feed images should be 4:5 (1080x1350). Add several for a carousel.</p>
        ) : null}
        {contentType === "STORY" ? (
          <p className="small muted">Each file is a story frame, in this order.</p>
        ) : null}
        {contentType === "REEL" ? (
          <p className="small muted">The clip sits here. The cover above is what the grid shows.</p>
        ) : null}
        {slots.length > 1 ? <p className="small muted">Use the arrows to set the order.</p> : null}
        {slots.map((slot, index) => (
          <div key={slot.key} className="file-row">
            <span className="grow">{slot.kind === "saved" ? slot.name : slot.file.name}</span>
            <span className="file-move">
              <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => moveSlot(index, -1)}>
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={index === slots.length - 1}
                onClick={() => moveSlot(index, 1)}
              >
                ↓
              </button>
            </span>
            <button type="button" className="subtle link-serious" onClick={() => setSlots((current) => current.filter((item) => item.key !== slot.key))}>
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
              if (slots.length + chosen.length > MAX_FILES) {
                setError(`You can attach up to ${MAX_FILES} files.`);
                event.target.value = "";
                return;
              }
              setError(null);
              setSlots((current) => [
                ...current,
                ...chosen.map((file) => {
                  slotSeq.current += 1;
                  return { key: `new-${slotSeq.current}`, kind: "file" as const, file };
                }),
              ]);
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
