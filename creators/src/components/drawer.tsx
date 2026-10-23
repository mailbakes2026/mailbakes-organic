"use client";

import { useEffect, useRef, useState } from "react";
import { TikTokLink } from "@/components/tiktok-link";
import type { MatchOutcome } from "@/components/use-creators";
import { formatLondon, londonToday } from "@/lib/dates";
import { matchStatusClass } from "@/lib/match-status";
import { STAGES, type StageSlug } from "@/lib/stages";
import { opsStatusLabel, remoteStatusClass, type RemoteCheck } from "@/lib/ops";
import { normaliseHandle, tiktokProfileUrl } from "@/lib/tiktok";
import { royalMailTrackUrl } from "@/lib/tracking";
import type { ActivityDTO, CreatorDTO, CreatorFields } from "@/lib/types";

function fieldsOf(creator: CreatorDTO): CreatorFields {
  return {
    name: creator.name,
    handle: creator.handle,
    email: creator.email,
    shopifyOrder: creator.shopifyOrder,
    stage: creator.stage,
    rush: creator.rush,
    cardMessage: creator.cardMessage,
    notes: creator.notes,
    shipDate: creator.shipDate,
    courier: creator.courier,
    trackingNumber: creator.trackingNumber,
    declineReason: creator.declineReason,
    posted: creator.posted,
    postUrl: creator.postUrl,
    views: creator.views,
    orders: creator.orders,
    rating: creator.rating,
    worksWell: creator.worksWell,
    tiktokOrderId: creator.tiktokOrderId,
    tiktokMessage: creator.tiktokMessage,
  };
}

export function Drawer({
  creator,
  pending,
  error,
  onClose,
  onSave,
  onDelete,
  onMatch,
}: {
  creator: CreatorDTO;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (fields: CreatorFields & { sendToOrders?: boolean }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onMatch: () => Promise<MatchOutcome>;
}) {
  const [form, setForm] = useState(() => fieldsOf(creator));
  const [dirty, setDirty] = useState(false);
  const [orderIdEdited, setOrderIdEdited] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activities, setActivities] = useState<ActivityDTO[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [remote, setRemote] = useState<RemoteCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [matchState, setMatchState] = useState("busy");
  const [matchLabel, setMatchLabel] = useState("Matching orders…");
  const onMatchRef = useRef(onMatch);
  onMatchRef.current = onMatch;

  useEffect(() => {
    if (!dirty) {
      setForm(fieldsOf(creator));
      setOrderIdEdited(false);
      return;
    }
    if (orderIdEdited) return;
    setForm((current) => (current.tiktokOrderId === creator.tiktokOrderId ? current : { ...current, tiktokOrderId: creator.tiktokOrderId }));
  }, [creator, dirty, orderIdEdited]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (!dirty || confirmClose) onClose();
      else setConfirmClose(true);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [confirmClose, dirty, onClose]);

  useEffect(() => {
    let cancel = false;
    setActivities(null);
    setHistoryError(null);
    fetch(`/api/creators/${creator.id}`)
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          creator?: { activities: ActivityDTO[] };
        };
        if (cancel) return;
        if (!response.ok || !data.creator) {
          setHistoryError(data.error || "The history didn't load.");
          return;
        }
        setActivities(data.creator.activities);
      })
      .catch(() => {
        if (!cancel) setHistoryError("The history didn't load.");
      });
    return () => {
      cancel = true;
    };
  }, [creator.id, creator.updatedAt]);

  function requestClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  function blurHandle() {
    const next = normaliseHandle(form.handle);
    if (!next.ok || next.value === form.handle) return;
    update("handle", next.value);
  }

  function update<K extends keyof CreatorFields>(key: K, value: CreatorFields[K]) {
    setDirty(true);
    if (key === "tiktokOrderId") setOrderIdEdited(true);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onStage(stage: StageSlug) {
    setDirty(true);
    setForm((current) => ({
      ...current,
      stage,
      posted: stage === "posted" ? true : current.posted,
      shipDate: stage === "shipped" && !current.shipDate ? londonToday() : current.shipDate,
    }));
  }

  function onCount(key: "views" | "orders", raw: string) {
    if (raw.trim() === "") {
      update(key, null);
      return;
    }
    if (!/^\d{1,10}$/.test(raw)) return;
    const value = Number(raw);
    if (value > 1_000_000_000) return;
    update(key, value);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const ok = await onSave(form);
    if (ok) setDirty(false);
  }

  async function sendOrder() {
    const ok = await onSave({ ...form, sendToOrders: true });
    if (ok) setDirty(false);
  }

  const track = royalMailTrackUrl(form.trackingNumber, form.courier);
  const handleState = normaliseHandle(form.handle);
  const profile = handleState.ok ? tiktokProfileUrl(handleState.value) : null;
  const orderDraftChanged = form.tiktokOrderId !== creator.tiktokOrderId || form.tiktokMessage !== creator.tiktokMessage;
  const orderStatus = orderDraftChanged ? "" : creator.opsStatus;
  const orderError = orderDraftChanged ? "" : creator.opsError;

  useEffect(() => {
    if (orderDraftChanged || !creator.tiktokOrderId.trim()) {
      setRemote(null);
      setChecking(false);
      return;
    }
    const controller = new AbortController();
    setChecking(true);
    fetch(`/api/tiktok/check?id=${encodeURIComponent(creator.id)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { check?: RemoteCheck };
        if (!controller.signal.aborted && data.check) setRemote(data.check);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRemote(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, [creator.id, creator.tiktokOrderId, creator.tiktokMessage, creator.opsStatus, creator.opsSentAt, orderDraftChanged]);

  useEffect(() => {
    let cancel = false;
    setMatchState("busy");
    setMatchLabel("Matching orders…");
    onMatchRef.current().then((result) => {
      if (cancel) return;
      if (!result.ok) {
        setMatchState("failed");
        setMatchLabel(result.error);
        return;
      }
      const line = result.report.lines.find((item) => item.id === creator.id);
      if (line) {
        setMatchState(line.state);
        setMatchLabel(line.label);
        return;
      }
      setMatchState(result.report.state);
      setMatchLabel(result.report.summary);
    });
    return () => {
      cancel = true;
    };
  }, [creator.id]);

  return (
    <div className="drawer-back" onMouseDown={requestClose}>
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="creator-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-top">
          <div>
            <p className="eyebrow">Creator</p>
            <h2 id="creator-title">{form.name || creator.name}</h2>
            {creator.handle ? <p className={creator.handle.startsWith("@") ? "handle" : "meta"}>{creator.handle}</p> : null}
          </div>
          <button className="btn ghost sm" type="button" onClick={requestClose}>
            Close
          </button>
        </div>

        {confirmClose ? (
          <div className="alert warn">
            <span>You have unsaved changes.</span>
            <button className="btn sm" type="button" onClick={onClose}>
              Close without saving
            </button>
            <button className="btn ghost sm" type="button" onClick={() => setConfirmClose(false)}>
              Keep editing
            </button>
          </div>
        ) : null}

        <form onSubmit={save}>
          <div className="form-grid">
            <label className="field">
              Name
              <input value={form.name} onChange={(event) => update("name", event.target.value)} required maxLength={120} />
            </label>
            <label className="field wide">
              TikTok handle
              <input
                value={form.handle}
                onChange={(event) => update("handle", event.target.value)}
                onBlur={blurHandle}
                maxLength={300}
                spellCheck={false}
                placeholder="@handle"
              />
            </label>
            <div className="wide tiktok-slot">
              {profile ? (
                <TikTokLink handle={handleState.ok ? handleState.value : form.handle} variant="button" />
              ) : handleState.ok ? (
                <p className="add-handle">Add TikTok handle</p>
              ) : (
                <p className="error">{handleState.error}</p>
              )}
            </div>
            <label className="field">
              Email
              <input value={form.email} onChange={(event) => update("email", event.target.value)} type="email" maxLength={160} />
            </label>
            <label className="field">
              Shopify order #
              <input value={form.shopifyOrder} onChange={(event) => update("shopifyOrder", event.target.value)} maxLength={40} />
            </label>
            <label className="field">
              Stage
              <select value={form.stage} onChange={(event) => onStage(event.target.value as StageSlug)}>
                {STAGES.map((stage) => (
                  <option key={stage.slug} value={stage.slug}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="check drawer-check">
              <input type="checkbox" checked={form.rush} onChange={(event) => update("rush", event.target.checked)} />
              Rush
            </label>
            <label className="field wide">
              Card message
              <textarea value={form.cardMessage} onChange={(event) => update("cardMessage", event.target.value)} rows={4} maxLength={2000} />
            </label>
            <label className="field wide">
              Notes
              <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={3} maxLength={4000} />
            </label>
            <label className="field">
              Ship date
              <input type="date" value={form.shipDate ?? ""} onChange={(event) => update("shipDate", event.target.value || null)} />
            </label>
            <label className="field">
              Courier
              <input
                value={form.courier}
                onChange={(event) => update("courier", event.target.value)}
                placeholder="Royal Mail"
                maxLength={60}
              />
            </label>
            <label className="field wide">
              Tracking number
              <input
                value={form.trackingNumber}
                onChange={(event) => update("trackingNumber", event.target.value)}
                maxLength={40}
                spellCheck={false}
              />
            </label>
          </div>
          {track ? (
            <p className="track-line">
              <a href={track} target="_blank" rel="noopener noreferrer">
                Track on Royal Mail
              </a>
            </p>
          ) : form.trackingNumber && form.courier ? (
            <p className="muted small">Tracking link is for Royal Mail. This courier is {form.courier}.</p>
          ) : null}

          <h3 className="section-label">TikTok order</h3>
          <p className={`ops-status ${matchStatusClass(matchState)}`} aria-live="polite">
            {matchLabel}
          </p>
          <div className="form-grid">
            <label className="field wide">
              TikTok order ID
              <input
                value={form.tiktokOrderId}
                onChange={(event) => update("tiktokOrderId", event.target.value)}
                inputMode="numeric"
                spellCheck={false}
                autoComplete="off"
                maxLength={32}
                placeholder="Numbers only"
              />
            </label>
            <label className="field wide">
              Message for the order
              <textarea
                value={form.tiktokMessage}
                onChange={(event) => update("tiktokMessage", event.target.value)}
                rows={3}
                maxLength={2000}
              />
            </label>
          </div>
          <p className={`ops-status ${orderStatus || "empty"}`}>{opsStatusLabel(orderStatus, orderError)}</p>
          {orderDraftChanged ? null : checking && !remote ? <p className="ops-status empty">Checking the orders app…</p> : null}
          {remote && !orderDraftChanged ? (
            <p className={`ops-status ${remoteStatusClass(remote.state)}`}>{remote.label}</p>
          ) : null}
          <button className="btn" type="button" disabled={pending} onClick={sendOrder}>
            {orderStatus === "failed" ||
            orderStatus === "not_configured" ||
            remote?.state === "different" ||
            (remote?.state === "missing" && orderStatus === "sent")
              ? "Retry"
              : "Send to orders"}
          </button>

          {form.stage === "declined" ? (
            <label className="field">
              Decline reason
              <textarea value={form.declineReason} onChange={(event) => update("declineReason", event.target.value)} rows={2} maxLength={500} />
            </label>
          ) : null}

          <h3 className="section-label">Performance</h3>
          <div className="form-grid">
            <label className="check drawer-check">
              <input type="checkbox" checked={form.posted} onChange={(event) => update("posted", event.target.checked)} />
              Posted
            </label>
            <label className="check drawer-check">
              <input type="checkbox" checked={form.worksWell} onChange={(event) => update("worksWell", event.target.checked)} />
              Works well
            </label>
            <label className="field wide">
              Link to post
              <input
                value={form.postUrl}
                onChange={(event) => update("postUrl", event.target.value)}
                placeholder="https://"
                maxLength={500}
                inputMode="url"
              />
            </label>
            <label className="field">
              Views
              <input
                value={form.views ?? ""}
                onChange={(event) => onCount("views", event.target.value)}
                inputMode="numeric"
                placeholder="—"
              />
            </label>
            <label className="field">
              Orders attributed
              <input
                value={form.orders ?? ""}
                onChange={(event) => onCount("orders", event.target.value)}
                inputMode="numeric"
                placeholder="—"
              />
            </label>
          </div>
          <div className="rating-row">
            <span className="eyebrow">Rating</span>
            <div className="stars" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={form.rating !== null && star <= form.rating ? "on" : ""}
                  aria-label={`${star} out of 5`}
                  aria-pressed={form.rating === star}
                  onClick={() => update("rating", star)}
                >
                  ★
                </button>
              ))}
            </div>
            {form.rating ? (
              <button className="subtle" type="button" onClick={() => update("rating", null)}>
                Clear rating
              </button>
            ) : (
              <span className="muted small">Not rated</span>
            )}
          </div>

          {error ? <p className="error">{error}</p> : null}
          <div className="drawer-save">
            <button className="btn" type="submit" disabled={pending || !dirty}>
              {pending ? "Saving…" : "Save"}
            </button>
            <p className="muted small">Updated {formatLondon(new Date(creator.updatedAt))}</p>
          </div>
        </form>

        <h3 className="section-label">Activity</h3>
        {historyError ? <p className="error">{historyError}</p> : null}
        {activities === null && !historyError ? <p className="muted">Loading history…</p> : null}
        {activities && activities.length === 0 ? <p className="muted">No history yet.</p> : null}
        {activities && activities.length > 0 ? (
          <ol className="activity">
            {activities.map((item) => (
              <li key={item.id}>
                <time dateTime={item.createdAt}>{formatLondon(new Date(item.createdAt))}</time>
                <p>{item.detail}</p>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="danger-zone">
          {confirmDelete ? (
            <div className="row">
              <button className="btn danger" type="button" disabled={pending} onClick={() => onDelete(creator.id)}>
                Remove {creator.name}
              </button>
              <button className="btn ghost" type="button" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="subtle" type="button" onClick={() => setConfirmDelete(true)}>
              Remove from the pipeline
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
