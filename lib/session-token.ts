// Signs and verifies the login cookie. Used by proxy.ts and by server code.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
export const SESSION_DAYS = 30;

/**
 * Who is signed in. The admin (club owner) manages everything; a member only looks at
 * Tổng quan, Lịch and Quỹ of their own club.
 */
export type SessionUser = { kind: "admin"; id: string } | { kind: "member"; accountId: string };

/** The only screens a member may open. */
export const MEMBER_PATHS = ["/", "/schedule", "/fund", "/pay", "/account", "/logout"];

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser): Promise<string> {
  const claims = user.kind === "admin" ? { sub: user.id } : { sub: user.accountId, role: "account" };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

/**
 * The signed-in user, or null when the token is missing, expired or forged. Tokens without a role are the admin's.
 * Member tokens from before shared accounts (role "member") no longer count, so those members log in again.
 */
export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    if (payload.role === "account") return { kind: "member", accountId: payload.sub };
    return payload.role === undefined ? { kind: "admin", id: payload.sub } : null;
  } catch {
    return null;
  }
}
