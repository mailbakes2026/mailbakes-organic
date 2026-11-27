import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { appFromHost } from "@/lib/host";

export const dynamic = "force-dynamic";

export default async function PlanRedirect() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  redirect(appFromHost(host) ? "/calendar" : "/retention/calendar");
}
