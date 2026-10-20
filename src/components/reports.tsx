"use client";

import { useMemo, useState } from "react";
import { PostStatsForm } from "@/components/post-stats";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addMetric, followerAt, organicBag } from "@/lib/connections/model";
import { CHANNELS, contentLabel, platformLabel } from "@/lib/constants";
import {
  addDays,
  channelPosts,
  deltaTone,
  engagementOf,
  formatCount,
  formatDelta,
  formatRate,
  interactionsOf,
  londonToday,
  measuredPosts,
  publishedPosts,
  rankMeasured,
  statFor,
  sumMetric,
  weekRange,
  weekSummary,
  type MetricName,
} from "@/lib/report-math";
import type { ConnectionCardDTO, OrganicReportDTO, PlatformId, PostDTO } from "@/lib/types";

function formatDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatWeek(start: string, end: string) {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const left = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(ys, ms - 1, ds)),
  );
  const right = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ye, me - 1, de)));
  return `${left} – ${right}`;
}

function Delta({ current, previous }: { current: number; previous: number }) {
  return <span className={`wow wow-${deltaTone(current, previous)}`}>{formatDelta(current, previous)}</span>;
}

function followerSum(points: OrganicReportDTO["followers"], platforms: PlatformId[], end: string) {
  let total = 0;
  let seen = false;
  for (const platform of platforms) {
    const value = followerAt(points, platform, end);
    if (value == null) continue;
    total += value;
    seen = true;
  }
  return seen ? total : null;
}

export function Reports({
  posts,
  organic,
  connections,
  onChanged,
}: {
  posts: PostDTO[];
  organic: OrganicReportDTO;
  connections: ConnectionCardDTO[];
  onChanged: () => void;
}) {
  const [cursor, setCursor] = useState(londonToday);
  const [editing, setEditing] = useState<PostDTO | null>(null);
  const range = weekRange(cursor);
  const previousRange = { start: addDays(range.start, -7), end: addDays(range.start, -1) };
  const weekPosts = useMemo(() => publishedPosts(posts, range.start, range.end), [posts, range.start, range.end]);
  const previousPosts = useMemo(
    () => publishedPosts(posts, previousRange.start, previousRange.end),
    [posts, previousRange.start, previousRange.end],
  );
  const ranked = rankMeasured(measuredPosts(weekPosts));
  const worked = ranked[0] ?? null;
  const missed = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const summary = weekSummary(weekPosts, previousPosts);
  const openStats = editing ? posts.find((post) => post.id === editing.id) ?? editing : null;
  const reconnecting = connections.filter((card) => card.status === "NEEDS_RECONNECT");

  return (
    <div className="stack reports">
      <div className="page-head">
        <div>
          <h2>Week of {formatWeek(range.start, range.end)}</h2>
          <p className="muted">
            Approved posts, counted on the week of their planned date. A post on both Instagram and Facebook counts once
            under Meta. Typed-in stats stay as they are. Connected accounts fill the rest each day.
          </p>
        </div>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => setCursor(addDays(range.start, -7))} aria-label="Previous week">
            ‹
          </button>
          <button type="button" className="btn ghost" onClick={() => setCursor(londonToday())}>
            This week
          </button>
          <button type="button" className="btn ghost" onClick={() => setCursor(addDays(range.start, 7))} aria-label="Next week">
            ›
          </button>
        </div>
      </div>
      {reconnecting.length > 0 ? (
        <p className="alert crit">
          {reconnecting.map((card) => card.label).join(", ")} need{reconnecting.length === 1 ? "s" : ""} reconnecting on
          Connections before those stats can update.
        </p>
      ) : null}

      <section>
        <h3>Posts published</h3>
        <div className="kpi-row">
          {CHANNELS.map((channel) => {
            const current = channelPosts(weekPosts, channel.id);
            const previous = channelPosts(previousPosts, channel.id);
            return (
              <div key={channel.id} className="kpi" style={{ borderLeftColor: channel.colour }}>
                <div className="eyebrow">{channel.label}</div>
                <div className="kpi-figure">{current.length}</div>
                <Delta current={current.length} previous={previous.length} />
                {channel.id === "META" ? (
                  <p className="small muted">
                    Instagram {current.filter((post) => post.platforms.includes("INSTAGRAM")).length} · Facebook{" "}
                    {current.filter((post) => post.platforms.includes("FACEBOOK")).length}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3>Performance</h3>
        <p className="small muted">
          Engagement rate is likes, comments, shares and saves divided by views. Link clicks are counted beside that, not
          inside the rate.
        </p>
        <div className="tw">
          <table className="table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Posts</th>
                <th>Views</th>
                <th>Likes</th>
                <th>Comments</th>
                <th>Shares</th>
                <th>Saves</th>
                <th>Link clicks</th>
                <th>Interactions</th>
                <th>Eng. rate</th>
                <th>Vs last week</th>
              </tr>
            </thead>
            <tbody>
              {CHANNELS.map((channel) => {
                const currentPosts = channelPosts(weekPosts, channel.id);
                const previous = channelPosts(previousPosts, channel.id);
                const currentStats = currentPosts.flatMap((post) =>
                  channel.platforms.map((platform) => statFor(post, platform)),
                );
                const previousStats = previous.flatMap((post) => channel.platforms.map((platform) => statFor(post, platform)));
                const extra = organicBag(
                  channel.platforms,
                  new Set(currentPosts.map((post) => post.id)),
                  organic.posts,
                  organic.days,
                  range.start,
                  range.end,
                );
                const prevExtra = organicBag(
                  channel.platforms,
                  new Set(previous.map((post) => post.id)),
                  organic.posts,
                  organic.days,
                  previousRange.start,
                  previousRange.end,
                );
                const metric = (key: MetricName) => addMetric(sumMetric(currentStats, key), extra[key]);
                const prevMetric = (key: MetricName) => addMetric(sumMetric(previousStats, key), prevExtra[key]);
                const views = metric("views");
                const prevViews = prevMetric("views");
                const interactions = ["likes", "comments", "shares", "saves"].reduce<number | null>((sum, key) => {
                  const value = metric(key as MetricName);
                  if (value == null) return sum;
                  return (sum ?? 0) + value;
                }, null);
                const prevInteractions = ["likes", "comments", "shares", "saves"].reduce<number | null>((sum, key) => {
                  const value = prevMetric(key as MetricName);
                  if (value == null) return sum;
                  return (sum ?? 0) + value;
                }, null);
                const rate = views != null && views > 0 && interactions != null ? interactions / views : null;
                const prevRate =
                  prevViews != null && prevViews > 0 && prevInteractions != null ? prevInteractions / prevViews : null;
                return (
                  <tr key={channel.id}>
                    <td>
                      <span className="cal-tag" style={{ background: channel.colour, color: channel.ink }}>
                        {channel.short}
                      </span>
                      {channel.short === channel.label ? null : ` ${channel.label}`}
                    </td>
                    <td>
                      {currentPosts.length}
                      {extra.posts > 0 ? <div className="small muted">+{extra.posts} from the account</div> : null}
                    </td>
                    <td>{formatCount(views)}</td>
                    <td>{formatCount(metric("likes"))}</td>
                    <td>{formatCount(metric("comments"))}</td>
                    <td>{formatCount(metric("shares"))}</td>
                    <td>{formatCount(metric("saves"))}</td>
                    <td>{formatCount(metric("linkClicks"))}</td>
                    <td>{formatCount(interactions)}</td>
                    <td>{formatRate(rate)}</td>
                    <td>
                      {rate != null && prevRate != null ? (
                        <span className={`wow wow-${rate === prevRate ? "flat" : rate > prevRate ? "up" : "down"}`}>
                          {rate === prevRate
                            ? "No change"
                            : `${rate > prevRate ? "+" : "−"}${Math.abs((rate - prevRate) * 100).toFixed(1)} pts`}
                        </span>
                      ) : interactions != null && prevInteractions != null ? (
                        <Delta current={interactions} previous={prevInteractions} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Followers</h3>
        <p className="small muted">Latest count pulled from each connected account, compared with the end of last week.</p>
        <div className="kpi-row">
          {CHANNELS.map((channel) => {
            const current = followerSum(organic.followers, channel.platforms, range.end);
            const previous = followerSum(organic.followers, channel.platforms, previousRange.end);
            return (
              <div key={channel.id} className="kpi" style={{ borderLeftColor: channel.colour }}>
                <div className="eyebrow">{channel.label}</div>
                <div className="kpi-figure">{formatCount(current)}</div>
                {current != null && previous != null ? (
                  <Delta current={current} previous={previous} />
                ) : (
                  <span className="small muted">Not synced yet</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="report-split">
        <article className="card worked">
          <h3>What worked</h3>
          {worked ? <MeasuredCard row={worked} /> : <p className="muted">Add stats to a post this week to see the strongest one.</p>}
        </article>
        <article className="card missed">
          <h3>What didn’t</h3>
          {missed ? (
            <MeasuredCard row={missed} />
          ) : (
            <p className="muted">
              {worked
                ? "Only one post has stats this week, so there isn’t a weaker one to compare."
                : "Add stats to more than one post to see the weakest."}
            </p>
          )}
        </article>
      </section>
      <p className="report-summary">{summary}</p>

      <section>
        <h3>Posts this week</h3>
        {weekPosts.length === 0 ? (
          <p className="muted">No approved posts are planned in this week.</p>
        ) : (
          <div className="tw">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Post</th>
                  <th>Platform</th>
                  <th>Views</th>
                  <th>Interactions</th>
                  <th>Eng. rate</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {weekPosts.map((post) =>
                  post.platforms.map((platform, index) => {
                    const stat = statFor(post, platform);
                    return (
                      <tr key={`${post.id}-${platform}`}>
                        <td>{index === 0 ? `${formatDay(post.plannedDate)}${post.plannedTime ? ` ${post.plannedTime}` : ""}` : ""}</td>
                        <td>
                          {index === 0 ? (
                            <>
                              <b>{post.title}</b>
                              <div className="small muted">{contentLabel(post.contentType)}</div>
                            </>
                          ) : null}
                        </td>
                        <td>{platformLabel(platform)}</td>
                        <td>
                          {formatCount(stat?.views ?? null)}
                          {stat?.source === "API" ? <div className="small muted">Synced</div> : null}
                          {stat?.source === "MANUAL" ? <div className="small muted">Typed in</div> : null}
                        </td>
                        <td>{formatCount(interactionsOf(stat))}</td>
                        <td>{formatRate(engagementOf(stat))}</td>
                        <td>
                          {index === 0 ? (
                            <button type="button" className="btn ghost sm" onClick={() => setEditing(post)}>
                              {post.stats.length > 0 ? "Edit stats" : "Add stats"}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={openStats != null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent showCloseButton={false} className="sheet-form">
          {openStats ? (
            <div className="stack">
              <div className="sheet-head">
                <DialogHeader>
                  <DialogTitle>Stats for {openStats.title}</DialogTitle>
                  <DialogDescription>
                    {formatDay(openStats.plannedDate)}
                    {openStats.plannedTime ? ` at ${openStats.plannedTime}` : ""}. One set of numbers per platform.
                  </DialogDescription>
                </DialogHeader>
                <button type="button" className="btn ghost sm" onClick={() => setEditing(null)}>
                  Close
                </button>
              </div>
              <PostStatsForm
                key={openStats.id + openStats.stats.map((stat) => stat.platform + (stat.views ?? "")).join()}
                post={openStats}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  onChanged();
                }}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MeasuredCard({
  row,
}: {
  row: { post: PostDTO; platform: PostDTO["platforms"][number]; interactions: number | null; rate: number | null; stat: PostDTO["stats"][number] };
}) {
  return (
    <div>
      <p>
        <b>{row.post.title}</b>
      </p>
      <p className="small muted">
        {platformLabel(row.platform)} · {contentLabel(row.post.contentType)}
      </p>
      <p className="kpi-figure">{formatRate(row.rate)}</p>
      <p className="small">
        {formatCount(row.interactions)} interactions · {formatCount(row.stat.views)} views · {formatCount(row.stat.linkClicks)}{" "}
        link clicks
      </p>
    </div>
  );
}
