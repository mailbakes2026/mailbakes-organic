"use client";

import { formatDay, formatLondon } from "@/lib/dates";
import { STAGES, stageLabel, type StageSlug } from "@/lib/stages";
import type { CreatorDTO } from "@/lib/types";

export function CreatorCard({
  creator,
  dragging,
  onOpen,
  onMove,
  onPointerDown,
  consumeClick,
}: {
  creator: CreatorDTO;
  dragging: boolean;
  onOpen: (id: string) => void;
  onMove: (id: string, stage: StageSlug) => void;
  onPointerDown: (event: React.PointerEvent, id: string, name: string) => void;
  consumeClick: () => boolean;
}) {
  const shipBits = [
    creator.shipDate ? `Ship ${formatDay(creator.shipDate)}` : "",
    creator.courier,
  ].filter(Boolean);

  return (
    <article
      className={`creator${creator.rush ? " rush" : ""}${dragging ? " is-dragging" : ""}`}
      data-creator={creator.name}
      aria-label={`${creator.name}, ${stageLabel(creator.stage)}`}
      tabIndex={0}
      onPointerDown={(event) => onPointerDown(event, creator.id, creator.name)}
      onClick={() => {
        if (consumeClick()) return;
        onOpen(creator.id);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(creator.id);
        }
      }}
    >
      {creator.rush || creator.worksWell || (creator.posted && creator.stage !== "posted") ? (
        <div className="flags">
          {creator.rush ? <span className="pill warn">Rush</span> : null}
          {creator.worksWell ? <span className="pill ok">Works well</span> : null}
          {creator.posted && creator.stage !== "posted" ? <span className="pill">Posted</span> : null}
        </div>
      ) : null}
      <p className="creator-name">{creator.name}</p>
      {creator.handle ? <p className={creator.handle.startsWith("@") ? "handle" : "meta"}>{creator.handle}</p> : null}
      {creator.email ? (
        <a className="meta-link" href={`mailto:${creator.email}`} onClick={(event) => event.stopPropagation()}>
          {creator.email}
        </a>
      ) : null}
      {creator.shopifyOrder ? <p className="meta">{creator.shopifyOrder}</p> : null}
      {creator.cardMessage ? <p className="snippet">{creator.cardMessage}</p> : null}
      {creator.notes ? <p className="note">{creator.notes}</p> : null}
      {shipBits.length ? <p className="meta">{shipBits.join(" · ")}</p> : null}
      {creator.trackingNumber ? (
        creator.trackingUrl ? (
          <a
            className="meta-link"
            href={creator.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            Track {creator.trackingNumber}
          </a>
        ) : (
          <p className="meta">{creator.courier ? `${creator.courier} ${creator.trackingNumber}` : creator.trackingNumber}</p>
        )
      ) : null}
      {creator.declineReason ? <p className="note">{creator.declineReason}</p> : null}
      <p className="updated">Updated {formatLondon(new Date(creator.updatedAt))}</p>
      <label className="move" onClick={(event) => event.stopPropagation()}>
        <span>Move</span>
        <select
          aria-label={`Move ${creator.name}`}
          value={creator.stage}
          onChange={(event) => onMove(creator.id, event.target.value as StageSlug)}
        >
          {STAGES.map((stage) => (
            <option key={stage.slug} value={stage.slug}>
              {stage.label}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}
