import { NextResponse, type NextRequest } from "next/server";
import { verifyMicrosoftState } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { saveMicrosoftCode } from "@/lib/mail-accounts";

export const dynamic = "force-dynamic";

function back(code: string) {
  const response = NextResponse.redirect(new URL(`/inbox?outlook=${code}`, appUrl()));
  response.cookies.set("mb_ms_state", "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const state = url.searchParams.get("state") ?? "";
  const saved = request.cookies.get("mb_ms_state")?.value ?? "";
  if (!state || state !== saved || !(await verifyMicrosoftState(state))) return back("denied");
  const oauthError = url.searchParams.get("error");
  if (oauthError === "access_denied") return back("cancelled");
  if (oauthError) return back("denied");
  const code = url.searchParams.get("code");
  if (!code) return back("missing");
  try {
    await saveMicrosoftCode(code);
    return back("connected");
  } catch (error) {
    console.error(error);
    return back("denied");
  }
}
