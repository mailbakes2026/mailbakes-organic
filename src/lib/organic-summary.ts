export type SummaryPost = {
  status: string;
  plannedDate: string;
};

export type OrganicSummary = {
  awaiting_approval: number;
  approved_this_week: number;
  scheduled_next_7_days: number;
};

const AWAITING = new Set(["PENDING_APPROVAL", "CHANGES_REQUESTED", "AMENDMENTS_MADE"]);

type Env = Record<string, string | undefined>;

// Bracket access, read when sign-in style helpers run, so a production build
// cannot bake an empty ORGANIC_API_TOKEN from the build machine.
export function organicTokenFromEnv(env: Env): string {
  const value = env["ORGANIC_API_TOKEN"];
  return typeof value === "string" ? value.trim() : "";
}

function sameSecret(typed: string, expected: string) {
  if (typed.length === 0 || typed.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < typed.length; i++) diff |= typed.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function bearerMatches(header: string | null, expected: string): boolean {
  if (!expected) return false;
  const match = header ? /^Bearer\s+(\S+)\s*$/i.exec(header.trim()) : null;
  if (!match) return false;
  return sameSecret(match[1], expected);
}

export function londonDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOffset(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 6 : weekday - 1;
}

export function summariseOrganic(posts: SummaryPost[], now: Date): OrganicSummary {
  const today = londonDate(now);
  const monday = shiftDate(today, -mondayOffset(today));
  const sunday = shiftDate(monday, 6);
  const until = shiftDate(today, 6);
  let awaiting = 0;
  let approved = 0;
  let scheduled = 0;
  for (const post of posts) {
    if (AWAITING.has(post.status)) awaiting += 1;
    if (post.status === "APPROVED" && post.plannedDate >= monday && post.plannedDate <= sunday) approved += 1;
    if (post.status !== "REJECTED" && post.plannedDate >= today && post.plannedDate <= until) scheduled += 1;
  }
  return {
    awaiting_approval: awaiting,
    approved_this_week: approved,
    scheduled_next_7_days: scheduled,
  };
}

export async function organicSummaryResult(
  load: () => Promise<SummaryPost[]>,
  now: Date,
): Promise<{ status: 200; body: OrganicSummary } | { status: 503; body: { error: string } }> {
  try {
    const posts = await load();
    return { status: 200, body: summariseOrganic(posts, now) };
  } catch (error) {
    console.error(error);
    return { status: 503, body: { error: "The planner couldn't reach the database." } };
  }
}
