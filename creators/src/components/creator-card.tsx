"use client";

import { TikTokLink } from "@/components/tiktok-link";
import type { UnclaimedView } from "@/components/use-creators";
import { matchStatusClass } from "@/lib/match-status";
import { STAGES, stageLabel, type StageSlug } from "@/lib/stages";
import { tiktokProfileUrl } from "@/lib/tiktok";
import type { CreatorDTO } from "@/lib/types";

export function CreatorCard({
  creator,
  dragging,
  matchLabel,
  matchState,
  orders = [],
  onAttach,
  onOpen,
  onMove,
  onPointerDown,
  consumeClick,
}: {
  creator: CreatorDTO;
  dragging: boolean;
  matchLabel?: string;
  matchState?: string;
  orders?: UnclaimedView[];
  onAttach?: (tiktokOrderId: string) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, stage: StageSlug) => void;
  onPointerDown: (event: React.PointerEvent, id: string, name: string) => void;
  consumeClick: () => boolean;
}) {
  return (
    <article
      className={`creator${dragging ? " is-dragging" : ""}`}
      data-creator={creator.name}
      aria-label={`${creator.name}, ${stageLabel(creator.stage)}${matchLabel ? `, ${matchLabel}` : ""}`}
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
      {matchLabel ? <p className={`ops-status ${matchStatusClass(matchState ?? "")}`}>{matchLabel}</p> : null}
      {orders.length && onAttach ? (
        <label className="attach" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
          <span>Attach order</span>
          <select
            aria-label={`Attach an order to ${creator.name}`}
            value=""
            onChange={(event) => {
              const tiktokOrderId = event.target.value;
              if (tiktokOrderId) onAttach(tiktokOrderId);
            }}
          >
            <option value="">Choose an order</option>
            {orders.map((order) => (
              <option key={`${order.tiktokOrderId}-${order.reference}`} value={order.tiktokOrderId}>
                {[order.recipient, order.reference, order.tiktokOrderId].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </label>
      ) : null}
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
