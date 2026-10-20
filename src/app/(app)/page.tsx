import { redirect } from "next/navigation";
import { Planner } from "@/components/planner";
import { getSessionUser } from "@/lib/auth";
import { listConnectionCards, listOrganicReport } from "@/lib/connections/service";
import { getIgProfile } from "@/lib/ig-profile";
import { listNotes } from "@/lib/notes";
import { listKeyDates, listPosts } from "@/lib/service";

export const dynamic = "force-dynamic";

function connectionNotice(query: { connected?: string; error?: string }) {
  if (query.connected) return "Connected. Stats sync from that account each day, and you can use Sync now.";
  if (query.error === "setup") return "That platform still needs its app id and secret on the server.";
  if (query.error === "cancelled") return "The connection was cancelled.";
  if (query.error === "declined") return "The platform declined the connection.";
  if (query.error === "state") return "That connection link expired. Try Connect again.";
  if (query.error === "failed") return "The connection didn't finish. Try again.";
  if (query.error === "signin") return "Sign in as management to connect an account.";
  if (query.error === "unknown") return "That platform isn't available.";
  return null;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  const [posts, keyDates, profile, notes, connections, organic] = await Promise.all([
    listPosts(),
    listKeyDates(),
    getIgProfile(),
    listNotes(),
    listConnectionCards(),
    listOrganicReport(),
  ]);
  return (
    <Planner
      user={user}
      posts={posts}
      keyDates={keyDates}
      profile={profile}
      notes={notes}
      connections={connections}
      organic={organic}
      notice={connectionNotice(query)}
    />
  );
}
