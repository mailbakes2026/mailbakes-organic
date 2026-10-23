import { SHEET_ROWS, type SheetRow } from "./sheet-rows.ts";
import { stageFromSheetStatus, type StageSlug } from "./stages.ts";

export const SEEDED_AT = "2026-10-23T08:00:00.000Z";
export const SHEET_ACTIVITY = "Imported from the TikTok sample sheet.";

export type SeedCreator = {
  id: string;
  name: string;
  handle: string;
  email: string;
  shopifyOrder: string;
  stage: StageSlug;
  rush: boolean;
  cardMessage: string;
  notes: string;
  updated: string;
};

export function seedId(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `seed-${slug}`;
}

export function buildSeed(rows: SheetRow[] = SHEET_ROWS): SeedCreator[] {
  return rows.map((row) => {
    const mapped = stageFromSheetStatus(row.status);
    if (!mapped) throw new Error(`Unknown sample status: ${row.status}`);
    return {
      id: seedId(row.name),
      name: row.name,
      handle: row.handle,
      email: row.email,
      shopifyOrder: row.shopifyOrder,
      stage: mapped.stage,
      rush: mapped.rush,
      cardMessage: row.cardMessage,
      notes: row.notes,
      updated: row.updated,
    };
  });
}
