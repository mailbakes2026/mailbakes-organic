import { prisma } from "@/lib/prisma";
import { bearerMatches, organicSummaryResult, organicTokenFromEnv } from "@/lib/organic-summary";

export const dynamic = "force-dynamic";

function dayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const expected = organicTokenFromEnv(process.env);
  if (!bearerMatches(request.headers.get("authorization"), expected)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const result = await organicSummaryResult(async () => {
    const rows = await prisma.post.findMany({ select: { status: true, plannedDate: true } });
    return rows.map((row) => ({ status: row.status, plannedDate: dayString(row.plannedDate) }));
  }, new Date());
  return Response.json(result.body, { status: result.status });
}
