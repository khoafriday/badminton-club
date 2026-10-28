import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession, type SessionUser } from "./session-token";

export async function createSession(user: SessionUser) {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await signSession(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(SESSION_COOKIE)?.value);
}
