import { redirect } from "next/navigation";
import { Planner } from "@/components/planner";
import { getSessionUser } from "@/lib/auth";
import { getIgProfile } from "@/lib/ig-profile";
import { listKeyDates, listPosts } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [posts, keyDates, profile] = await Promise.all([listPosts(), listKeyDates(), getIgProfile()]);
  return <Planner user={user} posts={posts} keyDates={keyDates} profile={profile} />;
}
