export const EXPERIMENT_STATUSES = ["draft", "running", "winner", "ended"] as const;
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

export const EXPERIMENT_LABEL: Record<ExperimentStatus, string> = {
  draft: "Draft",
  running: "Running",
  winner: "Winner picked",
  ended: "Ended",
};

export type ExperimentInput = {
  flowId: string;
  flowName: string;
  name: string;
  hypothesis: string;
  variantA: string;
  variantB: string;
  splitA: number;
  status: ExperimentStatus;
  winner: "" | "a" | "b";
  metricName: string;
  metricA: string;
  metricB: string;
  lift: string;
  notes: string;
};

export function isExperimentStatus(value: unknown): value is ExperimentStatus {
  return typeof value === "string" && (EXPERIMENT_STATUSES as readonly string[]).includes(value);
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n/g, "\n").trim();
  if (text.length > max) return null;
  return text;
}

function hasOwn(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function readExperiment(value: unknown, mode: "create" | "patch") {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!record) return { ok: false as const, error: "Send a JSON object." };
  const data: Partial<ExperimentInput> = {};

  if (hasOwn(record, "name") || mode === "create") {
    const name = clean(record.name, 120);
    if (!name) return { ok: false as const, error: "Give the test a name, up to 120 characters." };
    data.name = name;
  }
  const textFields = [
    ["flowId", 80, "Flow"],
    ["flowName", 180, "Flow name"],
    ["hypothesis", 500, "Hypothesis"],
    ["variantA", 180, "Variant A"],
    ["variantB", 180, "Variant B"],
    ["metricName", 80, "Metric"],
    ["metricA", 40, "Variant A result"],
    ["metricB", 40, "Variant B result"],
    ["lift", 40, "Lift"],
    ["notes", 2000, "Notes"],
  ] as const;
  for (const [key, max, label] of textFields) {
    if (!hasOwn(record, key) && mode !== "create") continue;
    const text = clean(typeof record[key] === "string" ? record[key] : "", max);
    if (text === null) return { ok: false as const, error: `${label} must be ${max} characters or fewer.` };
    data[key] = text;
  }
  if (hasOwn(record, "splitA") || mode === "create") {
    const split = record.splitA === undefined ? 50 : record.splitA;
    if (typeof split !== "number" || !Number.isInteger(split) || split < 1 || split > 99) {
      return { ok: false as const, error: "Traffic split must be a whole number from 1 to 99 for variant A." };
    }
    data.splitA = split;
  }
  if (hasOwn(record, "status") || mode === "create") {
    const status = record.status === undefined && mode === "create" ? "draft" : record.status;
    if (!isExperimentStatus(status)) return { ok: false as const, error: "Status must be draft, running, winner, or ended." };
    data.status = status;
  }
  if (hasOwn(record, "winner") || mode === "create") {
    const winner = record.winner === undefined || record.winner === null ? "" : record.winner;
    if (winner !== "" && winner !== "a" && winner !== "b") return { ok: false as const, error: "Winner must be variant A, variant B, or blank." };
    data.winner = winner;
  }
  if (mode === "patch" && Object.keys(data).length === 0) return { ok: false as const, error: "Send at least one field to update." };
  return { ok: true as const, data };
}

export type ExperimentJson = ExperimentInput & {
  id: string;
  source: string;
  updatedBy: string;
  updatedAt: string;
};

export function experimentJson(row: {
  id: string;
  flowId: string;
  flowName: string;
  name: string;
  hypothesis: string;
  variantA: string;
  variantB: string;
  splitA: number;
  status: string;
  winner: string;
  metricName: string;
  metricA: string;
  metricB: string;
  lift: string;
  notes: string;
  source: string;
  updatedBy: string;
  updatedAt: Date;
}): ExperimentJson {
  return {
    id: row.id,
    flowId: row.flowId,
    flowName: row.flowName,
    name: row.name,
    hypothesis: row.hypothesis,
    variantA: row.variantA,
    variantB: row.variantB,
    splitA: row.splitA,
    status: isExperimentStatus(row.status) ? row.status : "draft",
    winner: row.winner === "a" || row.winner === "b" ? row.winner : "",
    metricName: row.metricName,
    metricA: row.metricA,
    metricB: row.metricB,
    lift: row.lift,
    notes: row.notes,
    source: row.source,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function experimentReady(input: ExperimentInput) {
  if (!input.name.trim()) return "Give the test a name.";
  if (input.status === "winner" && input.winner !== "a" && input.winner !== "b") {
    return "Pick variant A or variant B as the winner.";
  }
  if (input.splitA < 1 || input.splitA > 99) return "Traffic split must leave some traffic on each variant.";
  return null;
}
