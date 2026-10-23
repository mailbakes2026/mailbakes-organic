"use client";

import { TikTokLink } from "@/components/tiktok-link";
import { STAGES, stageLabel, type StageSlug } from "@/lib/stages";
import { tiktokProfileUrl } from "@/lib/tiktok";
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
  return (
    <article
      className={`creator${dragging ? " is-dragging" : ""}`}
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
      <div className="creator-line">
        <p className="creator-name">{creator.name}</p>
        {creator.rush || tiktokProfileUrl(creator.handle) ? (
          <span className="creator-marks">
            {creator.rush ? <span className="rush-badge">Rush</span> : null}
            <TikTokLink handle={creator.handle} variant="icon" />
          </span>
        ) : null}
      </div>
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
