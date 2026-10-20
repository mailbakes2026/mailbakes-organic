"use client";

import { useRef, useState } from "react";
import type { MediaDTO } from "@/lib/types";

export function MediaCarousel({ items, title }: { items: MediaDTO[]; title: string }) {
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const count = items.length;
  if (count === 0) return null;
  const safe = Math.min(index, count - 1);
  const media = items[safe];

  function step(delta: number) {
    setIndex((current) => Math.max(0, Math.min(count - 1, Math.min(current, count - 1) + delta)));
  }

  return (
    <div
      className="carousel"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("video, button")) return;
        startX.current = event.clientX;
      }}
      onPointerUp={(event) => {
        if (startX.current == null) return;
        const dx = event.clientX - startX.current;
        startX.current = null;
        if (dx > 40) step(-1);
        else if (dx < -40) step(1);
      }}
    >
      <div className="carousel-frame">
        {media.mimeType.startsWith("video/") ? (
          <video key={media.id} src={`/api/media/${media.id}`} controls playsInline />
        ) : (
          <img key={media.id} src={`/api/media/${media.id}`} alt={title} />
        )}
      </div>
      {count > 1 ? (
        <>
          <button
            type="button"
            className="carousel-arrow prev"
            aria-label="Previous"
            disabled={safe === 0}
            onClick={() => step(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="carousel-arrow next"
            aria-label="Next"
            disabled={safe === count - 1}
            onClick={() => step(1)}
          >
            ›
          </button>
          <div className="carousel-dots">
            {items.map((item, dot) => (
              <button
                key={item.id}
                type="button"
                className={dot === safe ? "on" : ""}
                aria-label={`Photo ${dot + 1} of ${count}`}
                onClick={() => setIndex(dot)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
