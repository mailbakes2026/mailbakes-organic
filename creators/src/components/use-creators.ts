"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { sortCreators } from "@/lib/order";
import type { CreatorPatch, InquiryInput } from "@/lib/parse";
import { royalMailTrackUrl, safeHttpUrl } from "@/lib/tracking";
import type { CreatorDTO, CreatorDetail, CreatorFields } from "@/lib/types";
import { applyUpdate } from "@/lib/update";

function decorate(row: CreatorDTO, fields: CreatorFields): CreatorDTO {
  return {
    ...row,
    ...fields,
    trackingUrl: royalMailTrackUrl(fields.trackingNumber, fields.courier),
    postHref: safeHttpUrl(fields.postUrl),
    updatedAt: new Date().toISOString(),
  };
}

export function useCreators(initial: CreatorDTO[]) {
  const router = useRouter();
  const signature = initial.map((row) => `${row.id}:${row.updatedAt}:${row.stage}:${row.rush}`).join("|");
  const [sig, setSig] = useState(signature);
  const [rows, setRows] = useState(initial);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (signature !== sig) {
    setSig(signature);
    setRows(initial);
    rowsRef.current = initial;
  }

  async function patch(id: string, body: CreatorPatch) {
    const previous = rowsRef.current;
    const current = previous.find((row) => row.id === id);
    if (!current) return { ok: false as const, error: "That creator isn't on the board." };
    const preview = applyUpdate(current, body);
    if (!preview.ok) {
      setError(preview.error);
      return { ok: false as const, error: preview.error };
    }
    const optimistic = sortCreators(previous.map((row) => (row.id === id ? decorate(row, preview.next) : row)));
    rowsRef.current = optimistic;
    setRows(optimistic);
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/creators/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; creator?: CreatorDetail };
      if (response.status === 401) {
        window.location.href = "/login";
        return { ok: false as const, error: "Sign in required." };
      }
      if (!response.ok || !data.creator) {
        rowsRef.current = previous;
        setRows(previous);
        const message = data.error || "That didn't save. Try again.";
        setError(message);
        return { ok: false as const, error: message };
      }
      const merged = sortCreators(rowsRef.current.map((row) => (row.id === id ? { ...row, ...data.creator! } : row)));
      rowsRef.current = merged;
      setRows(merged);
      router.refresh();
      return { ok: true as const, creator: data.creator };
    } catch {
      rowsRef.current = previous;
      setRows(previous);
      const message = "That didn't save. Try again.";
      setError(message);
      return { ok: false as const, error: message };
    } finally {
      setPending(false);
    }
  }

  async function create(body: InquiryInput) {
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; creator?: CreatorDetail };
      if (response.status === 401) {
        window.location.href = "/login";
        return { ok: false as const, error: "Sign in required." };
      }
      if (!response.ok || !data.creator) {
        const message = data.error || "That inquiry didn't save.";
        setError(message);
        return { ok: false as const, error: message };
      }
      const merged = sortCreators([data.creator, ...rowsRef.current.filter((row) => row.id !== data.creator!.id)]);
      rowsRef.current = merged;
      setRows(merged);
      router.refresh();
      return { ok: true as const, creator: data.creator };
    } catch {
      const message = "That inquiry didn't save.";
      setError(message);
      return { ok: false as const, error: message };
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/creators/${id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.status === 401) {
        window.location.href = "/login";
        return { ok: false as const, error: "Sign in required." };
      }
      if (!response.ok) {
        const message = data.error || "That creator is still on the board.";
        setError(message);
        return { ok: false as const, error: message };
      }
      const merged = rowsRef.current.filter((row) => row.id !== id);
      rowsRef.current = merged;
      setRows(merged);
      router.refresh();
      return { ok: true as const };
    } catch {
      const message = "That creator is still on the board.";
      setError(message);
      return { ok: false as const, error: message };
    } finally {
      setPending(false);
    }
  }

  return { rows, error, setError, pending, patch, create, remove };
}
