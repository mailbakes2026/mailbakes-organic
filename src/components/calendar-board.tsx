"use client";

import { useMemo, useState } from "react";
import { CHANNELS, channelsFor, statusLabel, type ChannelId } from "@/lib/constants";
import type { KeyDateDTO, PostDTO, StatusId } from "@/lib/types";

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

function monthCells(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const monthKey = first.slice(0, 7);
  while (cells.length > 7 && cells.slice(-7).every((day) => day.slice(0, 7) !== monthKey)) {
    cells.splice(-7, 7);
  }
  return cells;
}

function monthBounds(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

function chipClass(status: StatusId) {
  if (status === "APPROVED") return "approved";
  if (status === "CHANGES_REQUESTED") return "changes";
  if (status === "AMENDMENTS_MADE") return "amended";
  if (status === "DRAFT") return "draft";
  return "pending";
}

function matchesChannel(post: PostDTO, selected: Set<ChannelId>) {
  if (selected.size === 0) return false;
  return channelsFor(post.platforms).some((channel) => selected.has(channel.id));
}

export function CalendarBoard({
  posts,
  keyDates,
  cursor,
  view,
  onCursor,
  onView,
  onOpenPost,
  onOpenKey,
  onCreatePost,
  onMove,
}: {
  posts: PostDTO[];
  keyDates: KeyDateDTO[];
  cursor: string;
  view: "month" | "week";
  onCursor: (iso: string) => void;
  onView: (view: "month" | "week") => void;
  onOpenPost: (post: PostDTO) => void;
  onOpenKey: (item: KeyDateDTO) => void;
  onCreatePost: (date: string) => void;
  onMove: (id: string, date: string) => Promise<string | null>;
}) {
  const today = londonToday();
  const [channels, setChannels] = useState<Set<ChannelId>>(() => new Set(CHANNELS.map((item) => item.id)));
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ post: PostDTO; x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor);
      return { start, end: addDays(start, 6), days: Array.from({ length: 7 }, (_, index) => addDays(start, index)) };
    }
    const bounds = monthBounds(cursor);
    return { ...bounds, days: monthCells(cursor) };
  }, [cursor, view]);

  const visible = posts.filter((post) => post.status !== "REJECTED" && matchesChannel(post, channels));
  const monthKey = cursor.slice(0, 7);

  function shift(direction: number) {
    if (view === "week") onCursor(addDays(cursor, direction * 7));
    else {
      const [year, month] = cursor.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1 + direction, 1));
      onCursor(date.toISOString().slice(0, 10));
    }
  }

  function toggleChannel(id: ChannelId) {
    setChannels((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function showPeek(post: PostDTO, target: HTMLElement) {
    if (dragId) return;
    const rect = target.getBoundingClientRect();
    const width = 260;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const top = rect.bottom + 8 + 160 > window.innerHeight ? Math.max(8, rect.top - 168) : rect.bottom + 8;
    setPeek({ post, x: left, y: top });
  }

  function startDrag(event: React.PointerEvent<HTMLButtonElement>, post: PostDTO) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    setPeek(null);
    let moved = false;
    let day = post.plannedDate;

    function move(pointer: PointerEvent) {
      if (Math.hypot(pointer.clientX - startX, pointer.clientY - startY) > 6) moved = true;
      if (!moved) return;
      setDragId(post.id);
      const hit = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest("[data-day]");
      day = hit?.getAttribute("data-day") || post.plannedDate;
      setOverDay(day);
    }

    function up(pointer: PointerEvent) {
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragId(null);
      setOverDay(null);
      if (!moved) {
        onOpenPost(post);
        return;
      }
      pointer.preventDefault();
      const swallow = (click: Event) => {
        click.preventDefault();
        click.stopPropagation();
        window.removeEventListener("click", swallow, true);
      };
      window.addEventListener("click", swallow, true);
      if (day === post.plannedDate) return;
      void onMove(post.id, day).then((message) => setError(message));
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const peekPost = peek?.post;
  const peekMedia = peekPost?.media[0];

  return (
    <div className={`stack plan-cal${dragId ? " is-dragging" : ""}`}>
      <div className="page-head cal-toolbar">
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
        <div className="view-toggle" role="group" aria-label="Calendar range">
          <button type="button" className={view === "week" ? "on" : ""} onClick={() => onView("week")}>
            Week
          </button>
          <button type="button" className={view === "month" ? "on" : ""} onClick={() => onView("month")}>
            Month
          </button>
        </div>
      </div>

      <div className="channel-filters" role="group" aria-label="Filter by channel">
        <button
          type="button"
          className={`filter-chip${channels.size === CHANNELS.length ? " on" : ""}`}
          onClick={() => setChannels(new Set(CHANNELS.map((item) => item.id)))}
        >
          All
        </button>
        {CHANNELS.map((channel) => (
          <button
            key={channel.id}
            type="button"
            className={`filter-chip${channels.has(channel.id) ? " on" : ""}`}
            onClick={() => toggleChannel(channel.id)}
            style={{ ["--ch" as string]: channel.colour, ["--ink" as string]: channel.ink }}
          >
            {channel.label}
          </button>
        ))}
      </div>

      <p className="muted small cal-hint">
        Drag a post to another day to reschedule it. Click an empty part of a day to add a post. Hover a post to peek.
      </p>
      {error ? <p className="alert crit">{error}</p> : null}

      <div className="cal-head" aria-hidden="true">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <div key={label} className="cal-dow">
            {label}
          </div>
        ))}
      </div>
      <div className={`cal${view === "week" ? " cal-week" : ""}`}>
        {range.days.map((day) => {
          const outside = view === "month" && day.slice(0, 7) !== monthKey;
          const dayPosts = visible
            .filter((post) => post.plannedDate === day)
            .sort((a, b) => (a.plannedTime ?? "").localeCompare(b.plannedTime ?? "") || a.title.localeCompare(b.title));
          const marks = keyDates.filter((item) => item.date === day);
          return (
            <article
              key={day}
              data-day={day}
              className={`cal-cell${day === today ? " today" : ""}${outside ? " outside" : ""}${overDay === day ? " drop" : ""}`}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("[data-post], [data-key]")) return;
                onCreatePost(day);
              }}
            >
              <div className="cal-date">
                <span>{Number(day.slice(8))}</span>
                <button
                  type="button"
                  className="cal-add"
                  aria-label={`Add a post on ${formatDay(day)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCreatePost(day);
                  }}
                >
                  +
                </button>
              </div>
              {marks.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-key={item.id}
                  className={`cal-marker ${item.kind === "LAUNCH" ? "launch" : "keydate"}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenKey(item);
                  }}
                >
                  {item.kind === "LAUNCH" ? "Launch" : "Key"} · {item.title}
                </button>
              ))}
              {dayPosts.map((post) => {
                const tags = channelsFor(post.platforms);
                return (
                  <button
                    key={post.id}
                    type="button"
                    data-post={post.id}
                    className={`cal-chip ${chipClass(post.status)}${dragId === post.id ? " dragging" : ""}`}
                    style={{ ["--ch" as string]: tags[0]?.colour ?? "#1E1A1C" }}
                    onPointerDown={(event) => startDrag(event, post)}
                    onMouseEnter={(event) => showPeek(post, event.currentTarget)}
                    onMouseLeave={() => setPeek((current) => (current?.post.id === post.id ? null : current))}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {post.plannedTime ? <span className="cal-time">{post.plannedTime}</span> : null}
                    <span className="grow">{post.title}</span>
                  </button>
                );
              })}
            </article>
          );
        })}
      </div>

      <div className="legend">
        {CHANNELS.map((channel) => (
          <span key={channel.id}>
            <i className="swatch" style={{ background: channel.colour }} />
            {channel.label}
          </span>
        ))}
        <span>Solid is approved. Dashed is still in review.</span>
      </div>

      {peek && peekPost ? (
        <div className="cal-peek" style={{ left: peek.x, top: peek.y }} role="tooltip">
          <span className="cal-peek-media">
            {peekMedia ? (
              peekMedia.mimeType.startsWith("video/") ? (
                <video src={`/api/media/${peekMedia.id}#t=0.1`} muted playsInline preload="metadata" />
              ) : (
                <img src={`/api/media/${peekMedia.id}`} alt="" />
              )
            ) : (
              <span className="story-empty" />
            )}
          </span>
          <span className="cal-peek-copy">
            <b>{peekPost.title}</b>
            <span className="small muted">
              {formatDay(peekPost.plannedDate)}
              {peekPost.plannedTime ? ` · ${peekPost.plannedTime}` : ""} · {statusLabel(peekPost.status)}
            </span>
            {peekPost.caption ? <p>{peekPost.caption}</p> : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}
