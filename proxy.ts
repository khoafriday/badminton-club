import { NextResponse, type NextRequest } from "next/server";
import { MEMBER_PATHS, SESSION_COOKIE, verifySession } from "@/lib/session-token";

// Every page needs a valid login cookie, except the login page itself. A member only reaches MEMBER_PATHS.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/logout") return NextResponse.next();
  if (pathname === "/login") {
    return user ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // Server actions post to the page they sit on, so this also keeps members away from admin actions.
  if (user.kind === "member" && !MEMBER_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
