import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { destinationPath, requiresSession } from "@/lib/host";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const { pathname, search } = request.nextUrl;
  const destination = destinationPath(host, pathname);

  if (requiresSession(pathname, destination)) {
    const token = request.cookies.get("mb_growth")?.value;
    const secret = process.env.SESSION_SECRET;
    let signedIn = false;
    if (token && secret && secret.length >= 32) {
      try {
        await jwtVerify(token, new TextEncoder().encode(secret));
        signedIn = true;
      } catch {
        signedIn = false;
      }
    }
    if (!signedIn) {
      if (pathname.startsWith("/api/") || destination.startsWith("/api/")) {
        return NextResponse.json({ error: "Sign in required." }, { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const next = `${pathname}${search}`;
      url.search =
        next.startsWith("/") && !next.startsWith("//") && next.length < 240 && next !== "/"
          ? `?next=${encodeURIComponent(next)}`
          : "";
      return NextResponse.redirect(url);
    }
  }

  if (destination !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
