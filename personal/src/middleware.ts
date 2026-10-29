import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { NextResponse, type NextRequest } from "next/server";

// Same as SESSION_DAYS in lib/auth.ts (middleware can't import server-only code).
const SESSION_DAYS = 365;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/health" ||
    pathname === "/api/google/callback" ||
    pathname === "/api/microsoft/callback" ||
    pathname.startsWith("/api/v1/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    // The home-screen manifest is fetched without the sign-in cookie.
    pathname === "/manifest.webmanifest" ||
    pathname === "/icon.svg" ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("mb_personal")?.value;
  const secret = process.env.SESSION_SECRET;
  let signedIn = false;
  let session: JWTPayload | null = null;
  if (token && secret && secret.length >= 32) {
    try {
      session = (await jwtVerify(token, new TextEncoder().encode(secret))).payload;
      signedIn = true;
    } catch {
      signedIn = false;
    }
  }

  if (signedIn) {
    const response = NextResponse.next();
    // Renew the year-long sign-in at most once a day while it is being used.
    const issued = typeof session?.iat === "number" ? session.iat : 0;
    if (secret && session?.sub && Date.now() / 1000 - issued > 24 * 60 * 60) {
      const renewed = await new SignJWT({ name: session.name })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(String(session.sub))
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DAYS}d`)
        .sign(new TextEncoder().encode(secret));
      response.cookies.set("mb_personal", renewed, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * SESSION_DAYS,
      });
    }
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
