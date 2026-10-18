import { redirect } from "next/navigation";
import { Planner } from "@/components/planner";
import { getSessionUser } from "@/lib/auth";
import { listKeyDates, listPosts } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [posts, keyDates] = await Promise.all([listPosts(), listKeyDates()]);
  return <Planner user={user} posts={posts} keyDates={keyDates} />;
}
