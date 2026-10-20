"use client";

import { useState } from "react";
import { platformLabel } from "@/lib/constants";
import { METRICS, statFor } from "@/lib/report-math";
import type { MetricName } from "@/lib/report-math";
import type { PlatformId, PostDTO } from "@/lib/types";

export function PostStatsForm({
  post,
  onSaved,
  onCancel,
}: {
  post: PostDTO;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const platform of post.platforms) {
      const stat = statFor(post, platform);
      for (const metric of METRICS) {
        const value = stat?.[metric.key];
        initial[`${platform}:${metric.key}`] = value == null ? "" : String(value);
      }
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setMetric(platform: PlatformId, key: MetricName, value: string) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setValues((current) => ({ ...current, [`${platform}:${key}`]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const stats = post.platforms.map((platform) => {
      const row: Record<string, string | null> = { platform };
      for (const metric of METRICS) {
        const value = values[`${platform}:${metric.key}`] ?? "";
        row[metric.key] = value === "" ? null : value;
      }
      return row;
    });
    const response = await fetch(`/api/posts/${post.id}/stats`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stats }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Couldn't save those stats.");
      return;
    }
    onSaved();
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <p className="small muted">
        Leave a box empty if you don’t have the number. Zero is a real zero. Saving stats does not change approval.
      </p>
      {post.platforms.map((platform) => (
        <fieldset key={platform} className="stat-block">
          <legend>{platformLabel(platform)}</legend>
          <div className="stat-grid">
            {METRICS.map((metric) => (
              <label key={metric.key} className="field">
                {metric.label}
                <input
                  inputMode="numeric"
                  value={values[`${platform}:${metric.key}`] ?? ""}
                  onChange={(event) => setMetric(platform, metric.key, event.target.value)}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {error ? <p className="error">{error}</p> : null}
      <div className="row">
        {onCancel ? (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving…" : "Save stats"}
        </button>
      </div>
    </form>
  );
}
