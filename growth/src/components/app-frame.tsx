import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getSessionUser } from "@/lib/auth";
import { otherAppHref, publicBase, type AppId } from "@/lib/host";

export async function AppFrame({ app, children }: { app: AppId; children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  return (
    <Shell
      app={app}
      base={publicBase(host, app)}
      otherHref={otherAppHref(host, app)}
      otherLabel={app === "paidads" ? "Retention" : "Paid Ads"}
      user={user}
    >
      {children}
    </Shell>
  );
}
