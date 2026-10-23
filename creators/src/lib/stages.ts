export const STAGES = [
  { slug: "inquiry", prisma: "INQUIRY", label: "Inquiry", lane: "pipeline", hint: "Inbound request" },
  { slug: "approved", prisma: "APPROVED", label: "Approved", lane: "pipeline", hint: "" },
  { slug: "message_needed", prisma: "MESSAGE_NEEDED", label: "Message needed", lane: "pipeline", hint: "Waiting for their card message" },
  { slug: "ready_to_ship", prisma: "READY_TO_SHIP", label: "Ready to ship", lane: "pipeline", hint: "" },
  { slug: "shipped", prisma: "SHIPPED", label: "Shipped", lane: "pipeline", hint: "With tracking number" },
  { slug: "delivered", prisma: "DELIVERED", label: "Delivered", lane: "pipeline", hint: "" },
  { slug: "posted", prisma: "POSTED", label: "Posted", lane: "pipeline", hint: "Content received" },
  { slug: "on_hold", prisma: "ON_HOLD", label: "On hold", lane: "side", hint: "" },
  { slug: "declined", prisma: "DECLINED", label: "Declined", lane: "side", hint: "" },
] as const;

export type StageSlug = (typeof STAGES)[number]["slug"];
export type StagePrisma = (typeof STAGES)[number]["prisma"];

export const PIPELINE = STAGES.filter((stage) => stage.lane === "pipeline");
export const SIDE_LANES = STAGES.filter((stage) => stage.lane === "side");

export function stageLabel(slug: StageSlug) {
  return STAGES.find((stage) => stage.slug === slug)?.label ?? slug;
}

export function isStageSlug(value: string): value is StageSlug {
  return STAGES.some((stage) => stage.slug === value);
}

/** Map the sample-sheet Status cell onto a pipeline stage. */
export function stageFromSheetStatus(status: string): { stage: StageSlug; rush: boolean } | null {
  switch (status.trim().toLowerCase()) {
    case "approved":
      return { stage: "approved", rush: false };
    case "hold":
      return { stage: "on_hold", rush: false };
    case "waiting":
      return { stage: "message_needed", rush: false };
    case "need approve":
      return { stage: "inquiry", rush: false };
    case "need approve (rush)":
      return { stage: "inquiry", rush: true };
    default:
      return null;
  }
}
