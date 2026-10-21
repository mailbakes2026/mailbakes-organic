import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getSessionUser } from "@/lib/auth";
import { googleStatus } from "@/lib/google";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const google = await googleStatus();
  return (
    <Shell user={user} google={google}>
      {children}
    </Shell>
  );
}
