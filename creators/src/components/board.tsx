"use client";

import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { CreatorCard } from "@/components/creator-card";
import { Drawer } from "@/components/drawer";
import { StatsTiles } from "@/components/stats-tiles";
import { useCreators, type MatchReportView, type ReviewView } from "@/components/use-creators";
import { useStageDrag } from "@/components/use-drag";
import { PIPELINE, SIDE_LANES, STAGES, type StageSlug } from "@/lib/stages";
import { needsTiktokMatch } from "@/lib/ops";
import type { CreatorDTO } from "@/lib/types";
import { matchesQuery } from "@/lib/search";
import type { CreatorFields } from "@/lib/types";

export function Board({ creators }: { creators: CreatorDTO[] }) {
  const { rows, error, setError, pending, matching, matchReport, patch, remove, syncOrders, matchOrders, confirmOrder } = useCreators(creators);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<StageSlug | "">("");
  const [rushOnly, setRushOnly] = useState(false);
  const [awaitingOnly, setAwaitingOnly] = useState(false);
  const [worksOnly, setWorksOnly] = useState(false);
  const [postedOnly, setPostedOnly] = useState(false);
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const filtering = Boolean(query.trim() || stageFilter || rushOnly || awaitingOnly || worksOnly || postedOnly || unmatchedOnly);
  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (stageFilter && row.stage !== stageFilter) return false;
        if (rushOnly && !row.rush) return false;
        if (awaitingOnly && row.stage !== "message_needed") return false;
        if (worksOnly && !row.worksWell) return false;
        if (postedOnly && !row.posted) return false;
        if (unmatchedOnly && !needsTiktokMatch(row)) return false;
        return matchesQuery(row, query);
      }),
    [rows, query, stageFilter, rushOnly, awaitingOnly, worksOnly, postedOnly, unmatchedOnly],
  );

  async function move(id: string, stage: StageSlug) {
    if (pending) return;
    const current = rows.find((row) => row.id === id);
    if (!current || current.stage === stage) return;
    await patch(id, { stage });
  }

  const drag = useStageDrag(move);
  const open = rows.find((row) => row.id === openId) ?? null;
  const columns = stageFilter ? PIPELINE.filter((stage) => stage.slug === stageFilter) : PIPELINE;
  const lanes = stageFilter ? SIDE_LANES.filter((stage) => stage.slug === stageFilter) : SIDE_LANES;

  async function syncAll() {
    setSyncNote(null);
    const result = await syncOrders();
    if (result.ok) setSyncNote(result.summary);
  }

  async function save(fields: CreatorFields & { sendToOrders?: boolean }) {
    if (!open) return false;
    const result = await patch(open.id, fields);
    return result.ok;
  }

  async function deleteOpen(id: string) {
    const result = await remove(id);
    if (result.ok) setOpenId(null);
    return result.ok;
  }

  function column(stage: (typeof STAGES)[number], className: string) {
    const items = visible.filter((row) => row.stage === stage.slug);
    return (
      <section
        key={stage.slug}
        className={`${className}${drag.over === stage.slug ? " over" : ""}`}
        data-drop={stage.slug}
        aria-label={stage.label}
      >
        <header className="col-head">
          <div>
            <h2>{stage.label}</h2>
            {stage.hint ? <p>{stage.hint}</p> : null}
          </div>
          <span className="pill">{items.length}</span>
        </header>
        {items.length === 0 ? <p className="empty">{filtering ? "Nothing matches" : "None yet"}</p> : null}
        {items.map((creator) => (
          <CreatorCard
            key={creator.id}
            creator={creator}
            dragging={drag.activeId === creator.id}
            onOpen={setOpenId}
            onMove={move}
            onPointerDown={drag.pointerDown}
            consumeClick={drag.consumeClick}
          />
        ))}
      </section>
    );
  }

  return (
    <>
      <StatsTiles creators={rows} />
      {error ? (
        <p className="alert crit" role="alert">
          <span>{error}</span>
          <button className="subtle" type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </p>
      ) : null}
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name, handle, email or order"
          aria-label="Search creators"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select aria-label="Stage" value={stageFilter} onChange={(event) => setStageFilter(event.target.value as StageSlug | "")}>
          <option value="">All stages</option>
          {STAGES.map((stage) => (
            <option key={stage.slug} value={stage.slug}>
              {stage.label}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={rushOnly} onChange={(event) => setRushOnly(event.target.checked)} />
          Rush
        </label>
        <label className="check">
          <input type="checkbox" checked={awaitingOnly} onChange={(event) => setAwaitingOnly(event.target.checked)} />
          Awaiting message
        </label>
        <label className="check">
          <input type="checkbox" checked={worksOnly} onChange={(event) => setWorksOnly(event.target.checked)} />
          Works well
        </label>
        <label className="check">
          <input type="checkbox" checked={postedOnly} onChange={(event) => setPostedOnly(event.target.checked)} />
          Posted
        </label>
        <label className="check">
          <input type="checkbox" checked={unmatchedOnly} onChange={(event) => setUnmatchedOnly(event.target.checked)} />
          No TikTok match
        </label>
        <button className="btn ghost sm" type="button" disabled={pending} onClick={syncAll}>
          Sync all
        </button>
        <button className="btn ghost sm" type="button" disabled={matching} onClick={() => void matchOrders()}>
          {matching ? "Matching…" : "Match orders"}
        </button>
        {matchReport ? (
          <span className={`ops-status ${summaryClass(matchReport)}`} aria-live="polite">
            {matchReport.summary}
          </span>
        ) : null}
        {syncNote ? <span className="muted small">{syncNote}</span> : null}
        {filtering ? (
          <span className="muted small">
            {visible.length} of {rows.length}
          </span>
        ) : null}
      </div>

      {matchReport && matchReport.review.length ? (
        <MatchPanel
          key={matchReport.review.map((item) => `${item.tiktokOrderId}|${item.reference}|${item.recipient}|${item.reason}`).join("\n")}
          review={matchReport.review}
          creators={rows}
          pending={pending || matching}
          onConfirm={async (creatorId, tiktokOrderId) => {
            const confirmed = await confirmOrder(creatorId, tiktokOrderId);
            if (!confirmed.ok) return false;
            await matchOrders();
            return true;
          }}
        />
      ) : null}

      {columns.length ? (
        <div className="board-scroll">
          <div className="board-cols">{columns.map((stage) => column(stage, "col"))}</div>
        </div>
      ) : null}

      {lanes.length ? <div className="side-lanes">{lanes.map((stage) => column(stage, "lane"))}</div> : null}

      {drag.ghost
        ? createPortal(
            <div className="drag-ghost" style={{ left: drag.ghost.x + 14, top: drag.ghost.y + 14 }}>
              {drag.ghost.name}
            </div>,
            document.body,
          )
        : null}

      {open ? (
        <Drawer
          key={open.id}
          creator={open}
          pending={pending}
          error={error}
          onClose={() => setOpenId(null)}
          onSave={save}
          onDelete={deleteOpen}
          onMatch={matchOrders}
        />
      ) : null}
    </>
  );
}

function summaryClass(report: MatchReportView) {
  if (report.state === "failed" || report.lines.some((line) => line.state === "failed")) return "failed";
  if (report.state === "not_ready" || report.state === "not_configured" || report.lines.some((line) => line.state === "unmatched")) {
    return "not_configured";
  }
  return "sent";
}

function MatchPanel({
  review,
  creators,
  pending,
  onConfirm,
}: {
  review: ReviewView[];
  creators: CreatorDTO[];
  pending: boolean;
  onConfirm: (creatorId: string, tiktokOrderId: string) => Promise<boolean>;
}) {
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  async function confirm(index: number, event: React.FormEvent) {
    event.preventDefault();
    const item = review[index];
    const creatorId = choices[index] ?? "";
    if (!item?.tiktokOrderId || !creatorId || busy !== null) return;
    setBusy(index);
    try {
      await onConfirm(creatorId, item.tiktokOrderId);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="match-panel" aria-label="Orders to confirm">
      <h2>Confirm these orders</h2>
      <p className="muted small">These names did not match one creator. Choose who the order belongs to. Nothing is filled in until you confirm.</p>
      <ul className="match-list">
        {review.map((item, index) => (
          <li key={`${item.tiktokOrderId}-${item.reference}-${item.recipient}-${index}`} className="match-review">
            <div>
              <b>{item.recipient}</b>
              {item.reference ? <span className="meta"> {item.reference}</span> : null}
              {item.tiktokOrderId ? <span className="meta"> {item.tiktokOrderId}</span> : null}
              {item.freeSample ? <span className="pill">Free sample</span> : null}
              <p className="ops-status not_configured">{item.reason}</p>
            </div>
            {item.tiktokOrderId ? (
              <form className="match-actions" onSubmit={(event) => void confirm(index, event)}>
                <select
                  aria-label={`Creator for ${item.recipient}`}
                  value={choices[index] ?? ""}
                  onChange={(event) => setChoices((current) => ({ ...current, [index]: event.target.value }))}
                >
                  <option value="">Choose a creator</option>
                  {creators.map((creator) => (
                    <option key={creator.id} value={creator.id}>
                      {creator.name}
                    </option>
                  ))}
                </select>
                <button className="btn sm" type="submit" disabled={pending || busy !== null || !(choices[index] ?? "")}>
                  {busy === index ? "Confirming…" : "Confirm"}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
