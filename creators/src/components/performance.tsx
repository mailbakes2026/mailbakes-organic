"use client";

import { useMemo, useState } from "react";
import { Drawer } from "@/components/drawer";
import { useCreators } from "@/components/use-creators";
import { stageLabel } from "@/lib/stages";
import { leaderboard } from "@/lib/stats";
import { matchesQuery } from "@/lib/search";
import type { CreatorDTO, CreatorFields } from "@/lib/types";

function blank(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("en-GB");
}

export function Performance({ creators }: { creators: CreatorDTO[] }) {
  const { rows, error, setError, pending, patch, remove } = useCreators(creators);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const ranked = useMemo(
    () => leaderboard(rows.filter((row) => matchesQuery(row, query))),
    [rows, query],
  );
  const open = rows.find((row) => row.id === openId) ?? null;
  const posted = rows.filter((row) => row.posted).length;
  const worksWell = rows.filter((row) => row.worksWell).length;

  async function save(fields: CreatorFields) {
    if (!open) return false;
    const result = await patch(open.id, fields);
    return result.ok;
  }

  return (
    <>
      <p className="muted leader-note">
        {posted} posted · {worksWell} marked works well. Works well comes first, then rating, then orders and views.
      </p>
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
          placeholder="Search creators"
          aria-label="Search creators"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="tw">
        <table className="table as-cards">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Stage</th>
              <th>Posted</th>
              <th>Views</th>
              <th>Orders</th>
              <th>Rating</th>
              <th>Works well</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((creator) => (
              <tr key={creator.id} data-creator={creator.name}>
                <td data-label="Creator">
                  <button className="name-button" type="button" onClick={() => setOpenId(creator.id)}>
                    <b>{creator.name}</b>
                    {creator.handle ? <span>{creator.handle}</span> : null}
                  </button>
                </td>
                <td data-label="Stage">{stageLabel(creator.stage)}</td>
                <td data-label="Posted">
                  {creator.postHref ? (
                    <a href={creator.postHref} target="_blank" rel="noopener noreferrer">
                      View post
                    </a>
                  ) : creator.posted ? (
                    "Yes"
                  ) : (
                    "—"
                  )}
                </td>
                <td data-label="Views" className="num">
                  {blank(creator.views)}
                </td>
                <td data-label="Orders" className="num">
                  {blank(creator.orders)}
                </td>
                <td data-label="Rating">{creator.rating ? `${creator.rating} / 5` : "—"}</td>
                <td data-label="Works well">{creator.worksWell ? <span className="pill ok">Works well</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ranked.length === 0 ? <p className="muted">Nothing matches that search.</p> : null}

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
        />
      ) : null}
    </>
  );
}
