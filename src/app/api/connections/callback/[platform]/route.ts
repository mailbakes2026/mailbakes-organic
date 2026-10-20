import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { connectionBySlug, readState } from "@/lib/connections/catalog";
import { exchangeCode } from "@/lib/connections/pull";
import { assertManager, saveConnection } from "@/lib/connections/service";

export const dynamic = "force-dynamic";

function home(request: Request, query: string) {
  const url = new URL("/", request.url);
  url.search = query;
  return NextResponse.redirect(url);
}

export async function GET(request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform } = await context.params;
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (providerError) {
    const reason = providerError === "access_denied" ? "cancelled" : "declined";
    return home(request, `view=connections&error=${reason}&platform=${platform}`);
  }
  try {
    const user = await requireUser();
    assertManager(user.role);
    const spec = connectionBySlug(platform);
    if (!spec) return home(request, "view=connections&error=unknown");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const jar = await cookies();
    const saved = jar.get("mb_oauth")?.value;
    jar.delete("mb_oauth");
    const parsed = state ? await readState(state) : null;
    if (!code || !state || !saved || state !== saved || !parsed || parsed.slug !== spec.slug || parsed.userId !== user.id) {
      return home(request, `view=connections&error=state&platform=${spec.slug}`);
    }
    const tokens = await exchangeCode(spec, code);
    await saveConnection(spec.slug, user.id, tokens);
    return home(request, `view=connections&connected=${spec.slug}`);
  } catch {
    return home(request, `view=connections&error=failed&platform=${platform}`);
  }
}
