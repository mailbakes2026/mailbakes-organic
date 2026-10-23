import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { appPassword, sessionSecret } from "@/lib/env";
import { appFromHost, safeNext } from "@/lib/host";
import { prepareDatabase, prisma } from "@/lib/prisma";
import { logSafe } from "@/lib/scrub";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const app = appFromHost(host);
  const fallback = app ? "/" : "/";
  const nextPath = safeNext(params.next, fallback);

  try {
    await prepareDatabase();
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    logSafe("login database", error);
    return <LoginForm setup="We couldn't reach the database. Check DATABASE_URL and the disk, then try again." nextPath={nextPath} />;
  }

  const user = await getSessionUser();
  if (user) redirect(nextPath);

  const ready = Boolean(appPassword() && sessionSecret());
  return (
    <LoginForm
      setup={
        ready
          ? null
          : "Setup needed. Set APP_PASSWORD (at least 10 characters) and SESSION_SECRET (at least 32 characters), then restart."
      }
      nextPath={nextPath}
    />
  );
}
