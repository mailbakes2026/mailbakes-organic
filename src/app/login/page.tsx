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
          ? "No accounts yet. Set MANAGEMENT_EMAIL, MANAGEMENT_PASSWORD, TEAM_EMAIL and TEAM_PASSWORD, then restart."
          : null
      }
    />
  );
}
