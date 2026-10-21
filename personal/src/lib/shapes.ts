import type { RunStatus } from "@prisma/client";
import { parseDateOnly, parseSnoozeInput, snoozePreset } from "./dates.ts";

export class ValidationError extends Error {}

const STATUSES: Record<string, RunStatus> = {
  waiting: "WAITING",
  "needs millie": "NEEDS_MILLIE",
  needs_millie: "NEEDS_MILLIE",
  WAITING: "WAITING",
  NEEDS_MILLIE: "NEEDS_MILLIE",
  done: "DONE",
  DONE: "DONE",
};

export function statusLabel(status: RunStatus): "waiting" | "needs Millie" | "done" {
  if (status === "NEEDS_MILLIE") return "needs Millie";
  if (status === "DONE") return "done";
  return "waiting";
}

export function parseStatus(value: unknown): RunStatus | null {
  if (typeof value !== "string") return null;
  return STATUSES[value.trim()] ?? STATUSES[value.trim().toLowerCase()] ?? null;
}

export function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Send a JSON object.");
  }
  return value as Record<string, unknown>;
}

export function cleanText(value: unknown, label: string, max: number, required: boolean) {
  if (value == null || value === "") {
    if (required) throw new ValidationError(`Add a ${label}.`);
    return "";
  }
  if (typeof value !== "string") throw new ValidationError(`${label} must be text.`);
  const trimmed = value.trim();
  if (!trimmed && required) throw new ValidationError(`Add a ${label}.`);
  if (trimmed.length > max) throw new ValidationError(`${label} is too long.`);
  return trimmed;
}

export function cleanUrl(value: unknown) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") throw new ValidationError("The link must be a web address.");
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > 2000) throw new ValidationError("That link is too long.");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ValidationError("The link must be a web address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ValidationError("The link must start with http or https.");
  }
  return url.toString();
}

export function cleanDueOn(value: unknown) {
  if (typeof value !== "string" || !parseDateOnly(value)) {
    throw new ValidationError("The due date must be YYYY-MM-DD.");
  }
  return parseDateOnly(value)!;
}

export function cleanSnooze(body: Record<string, unknown>, now = new Date()): Date | null | undefined {
  if ("snooze" in body && body.snooze != null && body.snooze !== "") {
    const date = snoozePreset(String(body.snooze), now);
    if (!date) throw new ValidationError("Snooze must be later, tomorrow or week.");
    return date;
  }
  if (!("snoozedUntil" in body)) return undefined;
  if (body.snoozedUntil == null || body.snoozedUntil === "") return null;
  if (typeof body.snoozedUntil !== "string") throw new ValidationError("Snooze date must be YYYY-MM-DD.");
  const date = parseSnoozeInput(body.snoozedUntil, now);
  if (!date) throw new ValidationError("Snooze date must be YYYY-MM-DD, or a time still to come.");
  return date;
}
