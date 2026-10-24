import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { bootstrap } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  try {
    await bootstrap();
  } catch (error) {
    console.error(error);
    return (
      <LoginForm nextPath="/" setup="We couldn't reach the database. Check DATABASE_URL and try again." />
    );
  }

  const user = await getSessionUser();
  if (user) redirect("/");

  const count = await prisma.user.count();
  return (
    <LoginForm
      nextPath="/"
      setup={
        count === 0
          ? "No accounts yet. Set TEAM_PASSWORD for the Manager and MILLIE_PASSWORD for Millie, then restart."
          : null
      }
    />
  );
}
