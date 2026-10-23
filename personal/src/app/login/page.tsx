import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { appPassword, sessionSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error(error);
    return <LoginForm nextPath="/inbox" setup="We couldn't reach the database. Check DATABASE_URL and try again." />;
  }

  const user = await getSessionUser();
  if (user) redirect("/inbox");

  const ready = Boolean(appPassword() && sessionSecret());
  return (
    <LoginForm
      nextPath="/inbox"
      setup={
        ready
          ? null
          : "Setup needed. Set APP_PASSWORD (at least 10 characters) and SESSION_SECRET (at least 32 characters), then restart."
      }
    />
  );
}
