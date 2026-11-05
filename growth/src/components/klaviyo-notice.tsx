import { headers } from "next/headers";
import { klaviyoMissing } from "@/lib/env";
import { publicBase } from "@/lib/host";
import { KLAVIYO_NOT_CONNECTED } from "@/lib/retention/klaviyo-copy";

export async function KlaviyoNotice() {
  if (klaviyoMissing().length === 0) return null;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const href = `${publicBase(host, "retention")}/settings`;
  return (
    <p className="alert warn">
      {KLAVIYO_NOT_CONNECTED} <a href={href}>Open Settings</a> for the full steps.
    </p>
  );
}
