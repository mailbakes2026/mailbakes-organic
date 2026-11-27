"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EXPERIMENT_LABEL, EXPERIMENT_STATUSES, type ExperimentJson, type ExperimentStatus } from "@/lib/retention/experiments";

type Draft = {
  id?: string;
  flowId: string;
  flowName: string;
  name: string;
  hypothesis: string;
  variantA: string;
  variantB: string;
  splitA: string;
  status: ExperimentStatus;
  winner: "" | "a" | "b";
  metricName: string;
  metricA: string;
  metricB: string;
  lift: string;
  notes: string;
};

const EMPTY: Draft = {
  flowId: "",
  flowName: "",
  name: "",
  hypothesis: "",
  variantA: "",
  variantB: "",
  splitA: "50",
  status: "draft",
  winner: "",
  metricName: "Placed order rate",
  metricA: "",
  metricB: "",
  lift: "",
  notes: "",
};

async function sendJson(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || "That was not saved.");
  return data;
}

function fromExperiment(row: ExperimentJson): Draft {
  return {
    id: row.id,
    flowId: row.flowId,
    flowName: row.flowName,
    name: row.name,
    hypothesis: row.hypothesis,
    variantA: row.variantA,
    variantB: row.variantB,
    splitA: String(row.splitA),
    status: row.status,
    winner: row.winner,
    metricName: row.metricName,
    metricA: row.metricA,
    metricB: row.metricB,
    lift: row.lift,
    notes: row.notes,
  };
}

export function FlowTests({
  experiments,
  flows,
  focusId,
  allHref,
}: {
  experiments: ExperimentJson[];
  flows: { id: string; name: string }[];
  focusId?: string;
  allHref: string;
}) {
  const router = useRouter();
  const focus = flows.find((flow) => flow.id === focusId) ?? null;
  const visible = focus ? experiments.filter((row) => row.flowId === focus.id || row.flowName === focus.name) : experiments;
  const synced = experiments.filter((row) => row.source === "klaviyo");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const opened = useRef<string | null>(null);

  useEffect(() => {
    if (!focusId || opened.current === focusId) return;
    const flow = flows.find((item) => item.id === focusId);
    if (!flow) return;
    opened.current = focusId;
    setDraft({ ...EMPTY, flowId: flow.id, flowName: flow.name, status: "running" });
    window.setTimeout(() => document.getElementById("ab-form")?.scrollIntoView({ block: "start" }), 0);
  }, [focusId, flows]);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const split = Number(draft.splitA);
    setPending(true);
    setError(null);
    try {
      const payload = {
        flowId: draft.flowId,
        flowName: draft.flowName,
        name: draft.name,
        hypothesis: draft.hypothesis,
        variantA: draft.variantA,
        variantB: draft.variantB,
        splitA: split,
        status: draft.status,
        winner: draft.winner,
        metricName: draft.metricName,
        metricA: draft.metricA,
        metricB: draft.metricB,
        lift: draft.lift,
        notes: draft.notes,
      };
      if (draft.id) await sendJson(`/api/retention/flows/experiments/${draft.id}`, "PATCH", payload);
      else await sendJson("/api/retention/flows/experiments", "POST", payload);
      setDraft(focus ? { ...EMPTY, flowId: focus.id, flowName: focus.name, status: "running" } : null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That test was not saved.");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setPending(true);
    setError(null);
    try {
      await sendJson(`/api/retention/flows/experiments/${id}`, "DELETE", { confirm: true });
      if (draft?.id === id) setDraft(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That test was not removed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="stack-section" id="ab-tests" aria-label="A/B tests">
      <div className="subhead">
        <h2 className="section-title">{focus ? `A/B tests for ${focus.name}` : "A/B tests"}</h2>
        <div className="row">
          {focus ? (
            <a className="btn ghost sm" href={`${allHref}#ab-tests`}>
              All tests
            </a>
          ) : null}
          <button
            className="btn sm"
            type="button"
            onClick={() => setDraft(focus ? { ...EMPTY, flowId: focus.id, flowName: focus.name, status: "running" } : { ...EMPTY })}
          >
            New test
          </button>
        </div>
      </div>
      <p className="muted small">
        {synced.length
          ? `${synced.length} ${synced.length === 1 ? "test comes" : "tests come"} from stored Klaviyo data.`
          : "No Klaviyo flow experiments are stored yet. Add the test here so the team can review it."}
      </p>
      {error ? <p className="error">{error}</p> : null}
      {visible.length === 0 ? <article className="card"><p className="empty-state">No A/B tests for {focus ? "this flow" : "these flows"} yet.</p></article> : null}
      <div className="perf-list">
        {visible.map((row) => (
          <article className="perf-card" key={row.id}>
            <header>
              <div>
                <h3>{row.name}</h3>
                <span className="muted small">{row.flowName || "No flow linked"}</span>
              </div>
              <span className={`cal-pill is-${row.status === "winner" ? "approved" : row.status === "running" ? "scheduled" : row.status === "ended" ? "skipped" : "planned"}`}>
                {EXPERIMENT_LABEL[row.status]}
              </span>
            </header>
            {row.hypothesis ? <p>{row.hypothesis}</p> : null}
            <div className="variant-grid">
              <Variant label="A" name={row.variantA} split={row.splitA} metric={row.metricA} winner={row.winner === "a"} metricName={row.metricName} />
              <Variant label="B" name={row.variantB} split={100 - row.splitA} metric={row.metricB} winner={row.winner === "b"} metricName={row.metricName} />
            </div>
            {row.lift ? <p className="lift">Lift {row.lift}</p> : null}
            {row.notes ? <p className="muted small">{row.notes}</p> : null}
            <div className="row">
              <button className="btn ghost sm" type="button" onClick={() => setDraft(fromExperiment(row))}>
                Edit
              </button>
              <button className="btn ghost sm" type="button" disabled={pending} onClick={() => remove(row.id)}>
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      {draft ? (
        <form className="card test-form" id="ab-form" onSubmit={save}>
          <h3>{draft.id ? "Edit test" : "New test"}</h3>
          <label className="field">
            Flow
            <select
              value={draft.flowId}
              onChange={(event) => {
                const flow = flows.find((item) => item.id === event.target.value);
                setDraft({ ...draft, flowId: event.target.value, flowName: flow?.name ?? draft.flowName });
              }}
            >
              <option value="">Not linked</option>
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
          </label>
          {!draft.flowId ? (
            <label className="field">
              Flow name
              <input value={draft.flowName} onChange={(event) => setField("flowName", event.target.value)} maxLength={180} />
            </label>
          ) : null}
          <label className="field">
            Test name
            <input value={draft.name} onChange={(event) => setField("name", event.target.value)} maxLength={120} required />
          </label>
          <label className="field">
            Hypothesis
            <textarea value={draft.hypothesis} onChange={(event) => setField("hypothesis", event.target.value)} rows={2} maxLength={500} />
          </label>
          <div className="cal-form-grid">
            <label className="field">
              Variant A
              <input value={draft.variantA} onChange={(event) => setField("variantA", event.target.value)} maxLength={180} />
            </label>
            <label className="field">
              Variant B
              <input value={draft.variantB} onChange={(event) => setField("variantB", event.target.value)} maxLength={180} />
            </label>
            <label className="field">
              Traffic to A (%)
              <input value={draft.splitA} onChange={(event) => setField("splitA", event.target.value)} inputMode="numeric" />
            </label>
            <label className="field">
              Status
              <select value={draft.status} onChange={(event) => setField("status", event.target.value as ExperimentStatus)}>
                {EXPERIMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {EXPERIMENT_LABEL[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Winner
              <select value={draft.winner} onChange={(event) => setField("winner", event.target.value as Draft["winner"])}>
                <option value="">Not picked</option>
                <option value="a">Variant A</option>
                <option value="b">Variant B</option>
              </select>
            </label>
            <label className="field">
              Metric
              <input value={draft.metricName} onChange={(event) => setField("metricName", event.target.value)} maxLength={80} />
            </label>
            <label className="field">
              A result
              <input value={draft.metricA} onChange={(event) => setField("metricA", event.target.value)} maxLength={40} />
            </label>
            <label className="field">
              B result
              <input value={draft.metricB} onChange={(event) => setField("metricB", event.target.value)} maxLength={40} />
            </label>
            <label className="field">
              Lift
              <input value={draft.lift} onChange={(event) => setField("lift", event.target.value)} maxLength={40} placeholder="+12%" />
            </label>
          </div>
          <label className="field">
            Notes
            <textarea value={draft.notes} onChange={(event) => setField("notes", event.target.value)} rows={3} maxLength={2000} />
          </label>
          <div className="row">
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save test"}
            </button>
            <button className="btn ghost" type="button" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function Variant({ label, name, split, metric, winner, metricName }: { label: string; name: string; split: number; metric: string; winner: boolean; metricName: string }) {
  return (
    <div className={`variant${winner ? " is-winner" : ""}`}>
      <span className="eyebrow">Variant {label} · {split}%</span>
      <b>{name || "Not named"}</b>
      <span>{metric ? `${metricName || "Result"} ${metric}` : "No result yet"}</span>
      {winner ? <span className="cal-pill is-approved">Winner</span> : null}
    </div>
  );
}
