"use client";

import { useEffect, useRef, useState } from "react";
import type { StageSlug } from "@/lib/stages";

type Ghost = { x: number; y: number; name: string };

function isInteractive(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("a, button, input, select, textarea, label"));
}

export function useStageDrag(onDrop: (id: string, stage: StageSlug) => void) {
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const stop = useRef<(() => void) | null>(null);
  const suppressClick = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [over, setOver] = useState<StageSlug | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);

  useEffect(() => () => stop.current?.(), []);

  function pointerDown(event: React.PointerEvent, id: string, name: string) {
    if (event.button !== 0) return;
    if (isInteractive(event.target)) return;

    let armed = event.pointerType !== "touch";
    let dragging = false;
    let moved = false;
    let overStage: StageSlug | null = null;
    const originX = event.clientX;
    const originY = event.clientY;
    const pointerId = event.pointerId;
    const hold = window.setTimeout(() => {
      armed = true;
    }, 200);

    function halt() {
      window.clearTimeout(hold);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      stop.current = null;
      setActiveId(null);
      setOver(null);
      setGhost(null);
    }

    function onMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      const distance = Math.hypot(moveEvent.clientX - originX, moveEvent.clientY - originY);
      if (distance > 6) moved = true;
      if (!armed) {
        if (distance > 12) {
          suppressClick.current = true;
          halt();
        }
        return;
      }
      if (!dragging && distance < 6) return;
      dragging = true;
      moveEvent.preventDefault();
      setActiveId(id);
      setGhost({ x: moveEvent.clientX, y: moveEvent.clientY, name });
      const hit = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const next = (hit?.closest("[data-drop]")?.getAttribute("data-drop") as StageSlug | null) ?? null;
      if (next !== overStage) {
        overStage = next;
        setOver(next);
      }
    }

    function onUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      const dropped = dragging ? overStage : null;
      if (dragging || moved) {
        suppressClick.current = true;
        // The click after a drop often lands on the column, not this card.
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 0);
      }
      halt();
      if (dropped) onDropRef.current(id, dropped);
    }

    stop.current = halt;
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function consumeClick() {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  }

  return { pointerDown, consumeClick, activeId, over, ghost };
}
