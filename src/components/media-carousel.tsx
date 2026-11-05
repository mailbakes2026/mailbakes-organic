"use client";

import { useEffect, useRef, useState } from "react";
import { swipeAxis, swipeStep } from "@/lib/media-preview";
import type { MediaDTO } from "@/lib/types";

export type CarouselSlide = {
  key: string;
  src: string;
  mimeType: string;
  label: string;
};

type Gesture = {
  id: number;
  x: number;
  y: number;
  axis: "horizontal" | "vertical" | null;
  lastDx: number;
};

function useSlideGesture(count: number, onStep: (delta: -1 | 1) => void) {
  const frameRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const blockHorizontalScroll = (event: TouchEvent) => {
      if (gesture.current?.axis === "horizontal") event.preventDefault();
    };
    node.addEventListener("touchmove", blockHorizontalScroll, { passive: false });
    return () => node.removeEventListener("touchmove", blockHorizontalScroll);
  }, [count]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    if (count < 2) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a")) return;
    const video = target.closest("video");
    if (video) {
      const rect = video.getBoundingClientRect();
      if (event.clientY > rect.bottom - 56) return;
    }
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null, lastDx: 0 };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    current.lastDx = dx;
    if (current.axis == null) {
      const axis = swipeAxis(dx, dy);
      if (axis == null) return;
      current.axis = axis;
      if (axis === "vertical") {
        gesture.current = null;
        return;
      }
    }
    if (current.axis !== "horizontal") return;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDragging(true);
    setDragX(dx);
  }

  function finish(event: React.PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = current.lastDx;
    const axis = current.axis;
    gesture.current = null;
    setDragging(false);
    setDragX(0);
    if (axis !== "horizontal") return;
    suppressClick.current = true;
    const step = swipeStep(dx);
    if (step !== 0) onStep(step);
  }

  function onClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  return {
    frameRef,
    dragX,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onClickCapture,
    },
  };
}

export function MediaCarousel({
  items,
  title,
  slides,
}: {
  items?: MediaDTO[];
  title?: string;
  slides?: CarouselSlide[];
}) {
  const resolved =
    slides ??
    (items ?? []).map((item) => ({
      key: item.id,
      src: `/api/media/${item.id}`,
      mimeType: item.mimeType,
      label: title || item.fileName,
    }));
  const [index, setIndex] = useState(0);
  const count = resolved.length;
  const safe = Math.min(index, Math.max(count - 1, 0));

  function step(delta: -1 | 1) {
    setIndex((current) => {
      const bounded = Math.min(current, Math.max(count - 1, 0));
      return Math.max(0, Math.min(count - 1, bounded + delta));
    });
  }

  const gesture = useSlideGesture(count, step);
  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(count - 1, 0)));
  }, [count]);

  if (count === 0) return null;
  const atEdge = (safe === 0 && gesture.dragX > 0) || (safe === count - 1 && gesture.dragX < 0);
  const offset = gesture.dragging ? (atEdge ? gesture.dragX * 0.35 : gesture.dragX) : 0;

  return (
    <div className="carousel">
      <div className="carousel-frame" ref={gesture.frameRef} {...gesture.handlers}>
        <div
          className={gesture.dragging ? "carousel-track is-dragging" : "carousel-track"}
          style={{ transform: `translateX(calc(${-safe * 100}% + ${offset}px))` }}
        >
          {resolved.map((slide, slideIndex) => (
            <div className="carousel-slide" key={slide.key} aria-hidden={slideIndex === safe ? undefined : true}>
              {slide.mimeType.startsWith("video/") ? (
                <video src={slide.src} controls playsInline preload="metadata" />
              ) : (
                <img src={slide.src} alt={slide.label} draggable={false} />
              )}
            </div>
          ))}
        </div>
      </div>
      {count > 1 ? (
        <>
          <p className="sr-only">{`Slide ${safe + 1} of ${count}`}</p>
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
            {resolved.map((slide, dot) => (
              <button
                key={slide.key}
                type="button"
                className={dot === safe ? "on" : ""}
                aria-label={`Slide ${dot + 1} of ${count}`}
                onClick={() => setIndex(dot)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
