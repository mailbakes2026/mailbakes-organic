import type { StageSlug } from "./stages.ts";

export type CreatorFields = {
  name: string;
  handle: string;
  email: string;
  shopifyOrder: string;
  stage: StageSlug;
  rush: boolean;
  cardMessage: string;
  notes: string;
  shipDate: string | null;
  courier: string;
  trackingNumber: string;
  declineReason: string;
  posted: boolean;
  postUrl: string;
  views: number | null;
  orders: number | null;
  rating: number | null;
  worksWell: boolean;
  tiktokOrderId: string;
  tiktokMessage: string;
};

export type CreatorDTO = CreatorFields & {
  id: string;
  trackingUrl: string | null;
  postHref: string | null;
  opsStatus: "" | "sent" | "failed" | "not_configured";
  opsError: string;
  opsSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActivityDTO = {
  id: string;
  detail: string;
  createdAt: string;
};

export type CreatorDetail = CreatorDTO & {
  activities: ActivityDTO[];
};
