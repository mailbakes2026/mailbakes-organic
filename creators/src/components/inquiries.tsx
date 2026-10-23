"use client";

import { useState } from "react";
import { Drawer } from "@/components/drawer";
import { TikTokLink } from "@/components/tiktok-link";
import { useCreators } from "@/components/use-creators";
import { formatLondon } from "@/lib/dates";
import type { InquiryInput } from "@/lib/parse";
import { stageLabel } from "@/lib/stages";
import type { CreatorDTO, CreatorFields } from "@/lib/types";

const EMPTY: InquiryInput = {
  name: "",
  handle: "",
  email: "",
  shopifyOrder: "",
  cardMessage: "",
  notes: "",
  rush: false,
};

export function Inquiries({ creators, apiReady }: { creators: CreatorDTO[]; apiReady: boolean }) {
  const { rows, error, setError, pending, patch, create, remove, matchOrders } = useCreators(creators);
  const [form, setForm] = useState<InquiryInput>(EMPTY);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const waiting = rows.filter((row) => row.stage === "inquiry");
  const open = rows.find((row) => row.id === openId) ?? null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = await create({
      ...form,
      name: form.name.trim(),
      handle: form.handle.trim(),
      email: form.email.trim(),
      shopifyOrder: form.shopifyOrder.trim(),
    });
    if (result.ok) setForm(EMPTY);
  }

  async function accept(id: string) {
    await patch(id, { via: "accept", stage: "approved" });
  }

  async function decline(id: string) {
    const result = await patch(id, { via: "decline", stage: "declined", declineReason: reason.trim() });
    if (result.ok) {
      setDeclining(null);
      setReason("");
    }
  }

  async function save(fields: CreatorFields & { sendToOrders?: boolean }) {
    if (!open) return false;
    const result = await patch(open.id, fields);
    return result.ok;
  }

  return (
    <>
      {error ? (
        <p className="alert crit" role="alert">
          <span>{error}</span>
          <button className="subtle" type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </p>
      ) : null}

      {waiting.length === 0 ? <p className="muted empty-page">No inquiries waiting.</p> : null}
      <div className="inquiry-list">
        {waiting.map((creator) => (
          <article key={creator.id} className={`inquiry${creator.rush ? " rush" : ""}`} data-creator={creator.name}>
            <div className="inquiry-top">
              <div>
                <p className="creator-name">{creator.name}</p>
                {creator.handle ? <p className={creator.handle.startsWith("@") ? "handle" : "meta"}>{creator.handle}</p> : null}
                <TikTokLink handle={creator.handle} variant="text" />
              </div>
              <div className="flags">
                {creator.rush ? <span className="pill warn">Rush</span> : null}
                <span className="pill">{stageLabel(creator.stage)}</span>
              </div>
            </div>
            {creator.email ? <p className="meta">{creator.email}</p> : null}
            {creator.shopifyOrder ? <p className="meta">{creator.shopifyOrder}</p> : null}
            {creator.tiktokOrderId ? <p className="meta">TikTok order {creator.tiktokOrderId}</p> : null}
            {creator.cardMessage ? (
              <div>
                <p className="eyebrow">Card message</p>
                <p className="prose">{creator.cardMessage}</p>
              </div>
            ) : null}
            {creator.notes ? (
              <div>
                <p className="eyebrow">Notes</p>
                <p className="prose">{creator.notes}</p>
              </div>
            ) : null}
            <p className="updated">Updated {formatLondon(new Date(creator.updatedAt))}</p>
            {declining === creator.id ? (
              <div className="decline-box">
                <label className="field">
                  Reason, optional
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={500} />
                </label>
                <div className="row">
                  <button className="btn" type="button" disabled={pending} onClick={() => decline(creator.id)}>
                    Decline
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => {
                      setDeclining(null);
                      setReason("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="row">
                <button className="btn" type="button" disabled={pending} onClick={() => accept(creator.id)}>
                  Accept
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setDeclining(creator.id);
                    setReason("");
                  }}
                >
                  Decline
                </button>
                <button className="btn ghost" type="button" onClick={() => setOpenId(creator.id)}>
                  Details
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      <form className="card" onSubmit={submit}>
        <h2>Add an inquiry</h2>
        <div className="form-grid">
          <label className="field">
            Name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={120} />
          </label>
          <label className="field">
            TikTok handle
            <input
              value={form.handle}
              onChange={(event) => setForm({ ...form, handle: event.target.value })}
              maxLength={300}
              spellCheck={false}
              placeholder="@handle or profile link"
            />
          </label>
          <label className="field">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              maxLength={160}
            />
          </label>
          <label className="field">
            Shopify order #
            <input
              value={form.shopifyOrder}
              onChange={(event) => setForm({ ...form, shopifyOrder: event.target.value })}
              maxLength={40}
            />
          </label>
          <label className="field wide">
            Card message
            <textarea
              value={form.cardMessage}
              onChange={(event) => setForm({ ...form, cardMessage: event.target.value })}
              rows={3}
              maxLength={2000}
            />
          </label>
          <label className="field wide">
            Notes
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={2} maxLength={4000} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.rush} onChange={(event) => setForm({ ...form, rush: event.target.checked })} />
          Rush
        </label>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add inquiry"}
        </button>
        {apiReady ? null : (
          <p className="muted small">Set CREATORS_API_TOKEN on the server before an automation posts inquiries.</p>
        )}
      </form>

      {open ? (
        <Drawer
          key={open.id}
          creator={open}
          pending={pending}
          error={error}
          onClose={() => setOpenId(null)}
          onSave={save}
          onDelete={async (id) => {
            const result = await remove(id);
            if (result.ok) setOpenId(null);
            return result.ok;
          }}
          onMatch={matchOrders}
        />
      ) : null}
    </>
  );
}
