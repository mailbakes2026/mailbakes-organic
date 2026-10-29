import { NextResponse } from "next/server";
import { cookieOptions, getSessionUser, signMicrosoftState } from "@/lib/auth";
import { appUrl, microsoftConfigured, microsoftRedirectUri } from "@/lib/env";
import { microsoftAuthUrl } from "@/lib/mail-account-rules";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", appUrl()));
  if (!microsoftConfigured()) return NextResponse.redirect(new URL("/inbox?outlook=setup", appUrl()));
  const state = await signMicrosoftState();
  const response = NextResponse.redirect(
    microsoftAuthUrl({ clientId: process.env.MICROSOFT_CLIENT_ID!.trim(), redirectUri: microsoftRedirectUri(), state }),
  );
  response.cookies.set("mb_ms_state", state, cookieOptions(60 * 15));
  return response;
}
