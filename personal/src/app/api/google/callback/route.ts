import { NextResponse, type NextRequest } from "next/server";
import { verifyGoogleState } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { saveGoogleCode, SetupError } from "@/lib/google";

export const dynamic = "force-dynamic";

function back(code: string) {
  const response = NextResponse.redirect(new URL(`/inbox?google=${code}`, appUrl()));
  response.cookies.set("mb_google_state", "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const state = url.searchParams.get("state") ?? "";
  const saved = request.cookies.get("mb_google_state")?.value ?? "";
  if (!state || state !== saved || !(await verifyGoogleState(state))) return back("denied");
  const oauthError = url.searchParams.get("error");
  if (oauthError === "access_denied") return back("cancelled");
  if (oauthError) return back("denied");
  const code = url.searchParams.get("code");
  if (!code) return back("missing");
  try {
    await saveGoogleCode(code);
    return back("connected");
  } catch (error) {
    console.error(error);
    if (error instanceof SetupError && /refresh token/i.test(error.message)) return back("norefresh");
    return back("denied");
  }
}
