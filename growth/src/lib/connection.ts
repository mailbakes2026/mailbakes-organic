import { formatLondon } from "@/lib/dates";

export function connectionCopy(input: {
  name: string;
  missing: string[];
  sync: { status: string; detail: string; syncedAt: Date | null } | null;
  parked?: string;
}) {
  if (input.parked) return { state: "not-connected" as const, label: "Not connected", detail: input.parked };
  if (input.missing.length) {
    return {
      state: "not-connected" as const,
      label: "Not connected",
      detail: `${input.name} is not connected. Set ${input.missing.join(", ")}.`,
    };
  }
  if (input.sync?.status === "error") {
    return {
      state: "error" as const,
      label: "Last sync failed",
      detail: input.sync.detail || "The last sync failed.",
    };
  }
  if (input.sync?.syncedAt) {
    return {
      state: "connected" as const,
      label: "Connected",
      detail: `Last stored ${formatLondon(input.sync.syncedAt)}. ${input.sync.detail}`.trim(),
    };
  }
  return {
    state: "connected" as const,
    label: "Connected",
    detail: `${input.name} is connected. Nothing has been stored yet.`,
  };
}
