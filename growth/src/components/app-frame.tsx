import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getSessionUser } from "@/lib/auth";
import { otherAppHref, publicBase, type AppId } from "@/lib/host";
import { retentionChrome } from "@/lib/retention/chrome";

export async function AppFrame({ app, children }: { app: AppId; children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const chrome = app === "retention" ? await retentionChrome() : null;
  return (
    <Shell
      app={app}
      base={publicBase(host, app)}
      otherHref={otherAppHref(host, app)}
      otherLabel={app === "paidads" ? "Retention" : "Paid Ads"}
      user={user}
      needsOk={chrome?.needsOk ?? 0}
      klaviyoConnected={chrome?.connected ?? false}
    >
      {children}
    </Shell>
  );
}
