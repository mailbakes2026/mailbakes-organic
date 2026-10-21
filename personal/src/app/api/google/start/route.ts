import { NextResponse } from "next/server";
import { cookieOptions, getSessionUser, signGoogleState } from "@/lib/auth";
import { appUrl, googleConfigured } from "@/lib/env";
import { googleAuthUrl } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", appUrl()));
  if (!googleConfigured()) return NextResponse.redirect(new URL("/inbox?google=denied", appUrl()));
  const state = await signGoogleState();
  const response = NextResponse.redirect(googleAuthUrl(state));
  response.cookies.set("mb_google_state", state, cookieOptions(60 * 15));
  return response;
}
