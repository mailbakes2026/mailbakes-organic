import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { authorizeUrl, connectionBySlug, credentialsReady, signState } from "@/lib/connections/catalog";
import { encryptionReady } from "@/lib/connections/crypto";
import { assertManager } from "@/lib/connections/service";
import { cookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

function home(request: Request, query: string) {
  const url = new URL("/", request.url);
  url.search = query;
  return NextResponse.redirect(url);
}

export async function GET(request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform } = await context.params;
  try {
    const user = await requireUser();
    assertManager(user.role);
    const spec = connectionBySlug(platform);
    if (!spec) return home(request, "view=connections&error=unknown");
    if (!encryptionReady() || !credentialsReady(spec)) {
      return home(request, `view=connections&error=setup&platform=${spec.slug}`);
    }
    const state = await signState(spec.slug, user.id);
    const jar = await cookies();
    jar.set("mb_oauth", state, { ...cookieOptions(), maxAge: 600 });
    return NextResponse.redirect(authorizeUrl(spec, state));
  } catch {
    return home(request, "view=connections&error=signin");
  }
}
