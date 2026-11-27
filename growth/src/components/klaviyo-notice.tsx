import { headers } from "next/headers";
import { Callout } from "@/components/page-header";
import { klaviyoMissing } from "@/lib/env";
import { publicBase } from "@/lib/host";
import { KLAVIYO_NOT_CONNECTED } from "@/lib/retention/klaviyo-copy";

export async function KlaviyoNotice() {
  if (klaviyoMissing().length === 0) return null;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const href = `${publicBase(host, "retention")}/settings`;
  return (
    <Callout lead="Klaviyo is not connected.">
      {KLAVIYO_NOT_CONNECTED.replace("Klaviyo is not connected. ", "")} <a href={href}>Open Settings</a>
    </Callout>
  );
}
