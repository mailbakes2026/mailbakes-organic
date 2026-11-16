// Tells Millie's Personal app (her phone notifications) when the team adds or
// changes content. Never blocks or breaks a save: failures are only logged.
// Needs PERSONAL_URL (e.g. https://personal.mailbakes.com) and PERSONAL_API_TOKEN on Render.
import { contentLabel, platformLabel, statusLabel } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import type { UserDTO } from "@/lib/types";

const ORGANIC_URL = (process.env.APP_URL || "https://organic.mailbakes.com").replace(/\/$/, "");

type Notice = { key: string; title: string; body: string; url?: string };

export async function notifyPersonal(notice: Notice) {
  const base = (process.env.PERSONAL_URL ?? "").trim().replace(/\/$/, "");
  const token = (process.env.PERSONAL_API_TOKEN ?? "").trim();
  if (!base || !token) return;
  try {
    const response = await fetch(`${base}/api/v1/notify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ source: "organic", url: ORGANIC_URL, ...notice }),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) console.error("notify personal", response.status);
  } catch (error) {
    console.error("notify personal", error instanceof Error ? error.message : error);
  }
}

function hourKey(now: Date) {
  return now.toISOString().slice(0, 13);
}

/**
 * New posts from the team. Several posts in the same hour become one
 * notification ("Sophie added 3 posts") that buzzes once.
 */
export async function postsAdded(user: UserDTO, now = new Date()) {
  if (user.role !== "TEAM") return;
  const since = new Date(now);
  since.setUTCMinutes(0, 0, 0);
  const posts = await prisma.post.findMany({
    where: { authorId: user.id, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { title: true, platforms: true, contentType: true, status: true },
  });
  if (!posts.length) return;
  const first = user.name.split(" ")[0] || user.name;
  const title = posts.length === 1 ? `${first} added a post: ${posts[0].title}` : `${first} added ${posts.length} posts`;
  const body =
    posts.length === 1
      ? [posts[0].platforms.map((p) => platformLabel(p)).join(", "), contentLabel(posts[0].contentType), statusLabel(posts[0].status)]
          .filter(Boolean)
          .join(" · ")
      : posts.map((post) => post.title).join(" · ");
  await notifyPersonal({ key: `added:${user.id}:${hourKey(now)}`, title, body });
}

/** The team has sent something (back) to Millie for approval. */
export async function readyForApproval(user: UserDTO, post: { id: string; title: string }, what: "amended" | "resubmitted") {
  if (user.role !== "TEAM") return;
  const first = user.name.split(" ")[0] || user.name;
  await notifyPersonal({
    key: `ready:${post.id}:${hourKey(new Date())}`,
    title: what === "amended" ? `${first} made the changes: ${post.title}` : `${first} sent for approval: ${post.title}`,
    body: "Ready for you to approve.",
  });
}
