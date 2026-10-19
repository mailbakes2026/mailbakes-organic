"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import type { IgHighlightDTO, IgProfileDTO, PostDTO } from "@/lib/types";

function formatDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatIgStat(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const scaled = value / 1_000_000;
    return `${scaled.toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}m`;
  }
  if (abs >= 10_000) {
    const scaled = value / 1_000;
    const text = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1).replace(/\.0$/, "");
    return `${text}k`;
  }
  return value.toLocaleString("en-GB");
}

function linkHref(link: string) {
  if (/^https?:\/\//i.test(link)) return link;
  return `https://${link}`;
}

function gridLabel(post: PostDTO) {
  if (post.status === "APPROVED") return "Scheduled";
  if (post.status === "DRAFT") return "Draft";
  if (post.status === "CHANGES_REQUESTED") return "Changes";
  return "In review";
}

type DraftHighlight = {
  key: string;
  id: string | null;
  title: string;
  coverId: string | null;
  file: File | null;
  removeCover: boolean;
};

function draftFrom(item: IgHighlightDTO): DraftHighlight {
  return { key: item.id, id: item.id, title: item.title, coverId: item.coverId, file: null, removeCover: false };
}

export function InstaGrid({
  posts,
  profile,
  onOpen,
  onChanged,
}: {
  posts: PostDTO[];
  profile: IgProfileDTO;
  onOpen: (post: PostDTO) => void;
  onChanged: () => void;
}) {
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const [editing, setEditing] = useState(false);
  const planned = posts.filter(
    (post) => post.platforms.includes("INSTAGRAM") && post.contentType !== "STORY" && post.status !== "REJECTED",
  );
  const scheduled = planned.filter((post) => post.status === "APPROVED").length;
  const tiles = planned
    .filter((post) => includeDrafts || post.status === "APPROVED")
    .sort(
      (a, b) =>
        b.plannedDate.localeCompare(a.plannedDate) ||
        (b.plannedTime ?? "").localeCompare(a.plannedTime ?? "") ||
        b.createdAt.localeCompare(a.createdAt),
    );

  return (
    <div className="ig-page">
      <div className="feed-tools">
        <p className="muted">How the MailBakes Instagram profile will look. Newest post top left. Tap a tile to open it.</p>
        <p className="muted small">
          In this plan: {planned.length} {planned.length === 1 ? "post" : "posts"} · {scheduled} scheduled
        </p>
        <label className="check-line">
          <input type="checkbox" checked={includeDrafts} onChange={(event) => setIncludeDrafts(event.target.checked)} />
          Include drafts and posts in review
        </label>
      </div>
      <div className="ig-phone">
        <div className="ig-top">
          <div className="ig-avatar">
            <div className="ig-avatar-ring">
              <img src={profile.avatarId ? `/api/ig-media/${profile.avatarId}` : "/ig-default-avatar.svg"} alt="" />
            </div>
          </div>
          <div className="ig-handleline">
            <b>{profile.handle}</b>
            <Verified />
          </div>
          <div className="ig-name">{profile.displayName}</div>
          <div className="ig-stats">
            <div className="ig-stat">
              <b>{formatIgStat(profile.postsCount)}</b>
              <span>posts</span>
            </div>
            <div className="ig-stat">
              <b>{formatIgStat(profile.followersCount)}</b>
              <span>followers</span>
            </div>
            <div className="ig-stat">
              <b>{formatIgStat(profile.followingCount)}</b>
              <span>following</span>
            </div>
          </div>
          <button type="button" className="ig-edit" onClick={() => setEditing(true)}>
            Edit profile
          </button>
          {profile.bio ? <p className="ig-bio">{profile.bio}</p> : null}
          {profile.link ? (
            <a className="ig-link" href={linkHref(profile.link)} target="_blank" rel="noreferrer">
              <LinkIcon />
              {profile.link.replace(/^https?:\/\//i, "")}
            </a>
          ) : null}
        </div>
        <ul className="ig-highlights">
          {profile.highlights.map((item) => (
            <li key={item.id}>
              <span className="ig-highlight-cover">
                {item.coverId ? (
                  <img src={`/api/ig-media/${item.coverId}`} alt="" />
                ) : (
                  <span className="ig-highlight-placeholder" />
                )}
              </span>
              <span className="ig-highlight-title">{item.title}</span>
            </li>
          ))}
        </ul>
        <div className="ig-tabs" aria-hidden="true">
          <span className="on">
            <GridIcon />
          </span>
          <span>
            <ReelsIcon />
          </span>
          <span>
            <TaggedIcon />
          </span>
        </div>
        {tiles.length === 0 ? (
          <div className="ig-empty">
            <p>
              <b>No posts yet</b>
            </p>
            <p>When your social media manager adds Instagram posts, they&apos;ll fill this grid in order.</p>
          </div>
        ) : (
          <div className="ig-grid">
            {tiles.map((post) => (
              <button
                key={post.id}
                type="button"
                className={`ig-tile${post.status === "APPROVED" ? "" : " pending"}`}
                onClick={() => onOpen(post)}
                title={post.title}
              >
                <GridMedia post={post} />
                {post.contentType === "REEL" ? (
                  <span className="ig-reel" aria-label="Reel">
                    ▶
                  </span>
                ) : null}
                <span className="ig-meta">
                  <span>
                    {formatDay(post.plannedDate)}
                    {post.plannedTime ? (
                      <>
                        <br />
                        {post.plannedTime}
                      </>
                    ) : null}
                  </span>
                  <span className="ig-state">{gridLabel(post)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent showCloseButton={false} className="sheet-form">
          {editing ? (
            <ProfileEditor profile={profile} onClose={() => setEditing(false)} onChanged={onChanged} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GridMedia({ post }: { post: PostDTO }) {
  const media = post.media[0];
  if (!media) {
    return (
      <span className="ig-placeholder">
        <b>{post.title}</b>
        <span>{post.caption.length > 90 ? `${post.caption.slice(0, 90).trimEnd()}…` : post.caption}</span>
      </span>
    );
  }
  if (media.mimeType.startsWith("video/")) {
    return <video src={`/api/media/${media.id}#t=0.1`} muted playsInline preload="metadata" />;
  }
  return <img src={`/api/media/${media.id}`} alt="" />;
}

function ProfileEditor({
  profile,
  onClose,
  onChanged,
}: {
  profile: IgProfileDTO;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [handle, setHandle] = useState(profile.handle);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [link, setLink] = useState(profile.link);
  const [postsCount, setPostsCount] = useState(String(profile.postsCount));
  const [followersCount, setFollowersCount] = useState(String(profile.followersCount));
  const [followingCount, setFollowingCount] = useState(String(profile.followingCount));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [highlights, setHighlights] = useState<DraftHighlight[]>(profile.highlights.map(draftFrom));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  function moveHighlight(index: number, delta: number) {
    setHighlights((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  async function readError(response: Response, fallback: string) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    return data.error || fallback;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (highlights.some((item) => !item.title.trim())) {
      setError("Each highlight needs a name.");
      return;
    }
    const tooBig = [avatarFile, ...highlights.map((item) => item.file)].find(
      (file) => file && file.size > MAX_UPLOAD_BYTES,
    );
    if (tooBig) {
      setError(`${tooBig.name} is over 10MB.`);
      return;
    }
    setSaving(true);
    setError(null);
    const response = await fetch("/api/ig-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle,
        displayName,
        bio,
        link,
        postsCount,
        followersCount,
        followingCount,
        highlights: highlights.map((item) => ({ id: item.id, title: item.title })),
      }),
    });
    if (!response.ok) {
      setSaving(false);
      setError(await readError(response, "Couldn't save that profile."));
      return;
    }
    const saved = (await response.json()) as IgProfileDTO;
    const problems: string[] = [];
    if (avatarFile) {
      const body = new FormData();
      body.set("file", avatarFile);
      const uploaded = await fetch("/api/ig-profile/avatar", { method: "POST", body });
      if (!uploaded.ok) problems.push(await readError(uploaded, "Couldn't save the profile photo."));
    } else if (removeAvatar && profile.avatarId) {
      const cleared = await fetch("/api/ig-profile/avatar", { method: "DELETE" });
      if (!cleared.ok) problems.push(await readError(cleared, "Couldn't remove the profile photo."));
    }
    for (const [index, item] of highlights.entries()) {
      const id = saved.highlights[index]?.id;
      if (!id) continue;
      if (item.file) {
        const body = new FormData();
        body.set("file", item.file);
        const uploaded = await fetch(`/api/ig-profile/highlights/${id}/cover`, { method: "POST", body });
        if (!uploaded.ok) problems.push(await readError(uploaded, `Couldn't save the cover for ${item.title}.`));
      } else if (item.removeCover && item.coverId) {
        const cleared = await fetch(`/api/ig-profile/highlights/${id}/cover`, { method: "DELETE" });
        if (!cleared.ok) problems.push(await readError(cleared, `Couldn't remove the cover for ${item.title}.`));
      }
    }
    setHighlights((current) =>
      current.map((item, index) => ({ ...item, id: saved.highlights[index]?.id ?? item.id })),
    );
    setSaving(false);
    if (problems.length > 0) {
      setError(problems.join(" "));
      onChanged();
      return;
    }
    onChanged();
    onClose();
  }

  const avatarSrc = avatarPreview
    ? avatarPreview
    : removeAvatar || !profile.avatarId
      ? "/ig-default-avatar.svg"
      : `/api/ig-media/${profile.avatarId}`;

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="sheet-head">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            This is the Instagram header on the grid. It does not post anything.
          </DialogDescription>
        </DialogHeader>
        <button type="button" className="btn ghost sm" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="field">
        <span>Profile photo</span>
        <div className="ig-editor-avatar">
          <img src={avatarSrc} alt="" />
          <label className="ig-file">
            Upload
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => {
                setAvatarFile(event.target.files?.[0] ?? null);
                setRemoveAvatar(false);
                event.target.value = "";
              }}
            />
          </label>
          {profile.avatarId || avatarFile ? (
            <button
              type="button"
              className="subtle link-serious"
              onClick={() => {
                setAvatarFile(null);
                setRemoveAvatar(true);
              }}
            >
              Use the pink placeholder
            </button>
          ) : null}
        </div>
      </div>
      <div className="grid">
        <label className="field" htmlFor="ig-name">
          Display name
          <input id="ig-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        </label>
        <label className="field" htmlFor="ig-handle">
          Handle
          <input id="ig-handle" value={handle} onChange={(event) => setHandle(event.target.value)} required />
        </label>
      </div>
      <label className="field" htmlFor="ig-bio">
        Bio
        <textarea id="ig-bio" rows={4} value={bio} onChange={(event) => setBio(event.target.value)} />
        <p className="small muted">One line per sentence. Emoji stay as you type them.</p>
      </label>
      <label className="field" htmlFor="ig-link">
        Link
        <input id="ig-link" value={link} onChange={(event) => setLink(event.target.value)} />
      </label>
      <div className="ig-stat-fields">
        <label className="field" htmlFor="ig-posts">
          Posts
          <input
            id="ig-posts"
            inputMode="numeric"
            value={postsCount}
            onChange={(event) => setPostsCount(event.target.value)}
            required
          />
        </label>
        <label className="field" htmlFor="ig-followers">
          Followers
          <input
            id="ig-followers"
            inputMode="numeric"
            value={followersCount}
            onChange={(event) => setFollowersCount(event.target.value)}
            required
          />
        </label>
        <label className="field" htmlFor="ig-following">
          Following
          <input
            id="ig-following"
            inputMode="numeric"
            value={followingCount}
            onChange={(event) => setFollowingCount(event.target.value)}
            required
          />
        </label>
      </div>
      <p className="small muted">
        These are the numbers on the Instagram profile. Type the full follower count, for example 130000, and the grid
        shows 130k. Posts planned in Organic are counted separately.
      </p>
      <div>
        <div className="field">
          <span>Highlights</span>
        </div>
        {highlights.map((item, index) => (
          <HighlightRow
            key={item.key}
            item={item}
            index={index}
            total={highlights.length}
            onChange={(next) =>
              setHighlights((current) => current.map((row) => (row.key === item.key ? next : row)))
            }
            onMove={(delta) => moveHighlight(index, delta)}
            onRemove={() => setHighlights((current) => current.filter((row) => row.key !== item.key))}
          />
        ))}
        <button
          type="button"
          className="btn ghost sm"
          onClick={() =>
            setHighlights((current) => [
              ...current,
              {
                key: crypto.randomUUID(),
                id: null,
                title: "",
                coverId: null,
                file: null,
                removeCover: false,
              },
            ])
          }
        >
          Add highlight
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="row">
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

function HighlightRow({
  item,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  item: DraftHighlight;
  index: number;
  total: number;
  onChange: (next: DraftHighlight) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!item.file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(item.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [item.file]);
  const src = preview ? preview : !item.removeCover && item.coverId ? `/api/ig-media/${item.coverId}` : null;

  return (
    <div className="ig-editor-row">
      <span className="ig-editor-cover">{src ? <img src={src} alt="" /> : <span />}</span>
      <label className="field" htmlFor={`highlight-${item.key}`}>
        Name
        <input
          id={`highlight-${item.key}`}
          value={item.title}
          onChange={(event) => onChange({ ...item, title: event.target.value })}
        />
      </label>
      <div className="ig-editor-actions">
        <label className="ig-file">
          Cover
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              onChange({ ...item, file: event.target.files?.[0] ?? null, removeCover: false });
              event.target.value = "";
            }}
          />
        </label>
        {src ? (
          <button type="button" className="subtle" onClick={() => onChange({ ...item, file: null, removeCover: true })}>
            Clear cover
          </button>
        ) : null}
        <button type="button" className="btn ghost sm" disabled={index === 0} onClick={() => onMove(-1)}>
          Up
        </button>
        <button type="button" className="btn ghost sm" disabled={index === total - 1} onClick={() => onMove(1)}>
          Down
        </button>
        <button type="button" className="subtle link-serious" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}

function Verified() {
  return (
    <svg className="ig-verified" viewBox="0 0 24 24" width="18" height="18" aria-label="Verified">
      <circle cx="12" cy="12" r="12" fill="#0095F6" />
      <path
        d="M7 12.4 10.2 15.6 17 8.8"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 3h5.2v5.2H3V3Zm6.4 0h5.2v5.2H9.4V3ZM15.8 3H21v5.2h-5.2V3ZM3 9.4h5.2v5.2H3V9.4Zm6.4 0h5.2v5.2H9.4V9.4Zm6.4 0H21v5.2h-5.2V9.4ZM3 15.8h5.2V21H3v-5.2Zm6.4 0h5.2V21H9.4v-5.2Zm6.4 0H21V21h-5.2v-5.2Z"
      />
    </svg>
  );
}

function ReelsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 9.2v5.6L15.2 12 10 9.2Z" fill="currentColor" />
      <path d="M4 8.2 7.2 4.2M9 8.2 12.2 4.2M14 8.2 17.2 4.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function TaggedIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.5 17.5c.8-2 2.4-3 4.5-3s3.7 1 4.5 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
