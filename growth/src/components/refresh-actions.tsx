import { SyncButton } from "@/components/sync-button";
import { klaviyoMissing, shopifyMissing } from "@/lib/env";

export function RefreshActions({ shopify = false }: { shopify?: boolean }) {
  const klaviyo = klaviyoMissing().length === 0;
  const shop = shopify && shopifyMissing().length === 0;
  if (!klaviyo && !shop) return null;
  return (
    <>
      {klaviyo ? <SyncButton href="/api/retention/sync/klaviyo" label="Refresh Klaviyo" /> : null}
      {shop ? <SyncButton href="/api/retention/sync/shopify" label="Refresh Shopify" /> : null}
    </>
  );
}
