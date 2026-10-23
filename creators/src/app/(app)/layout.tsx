import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getSessionUser } from "@/lib/auth";
import { inquiryCount, ensureSeeded } from "@/lib/records";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  await ensureSeeded();
  const waiting = await inquiryCount();
  return (
    <Shell user={user} inquiryCount={waiting}>
      {children}
    </Shell>
  );
}
