import { randomInt } from "node:crypto";
import { foldText } from "./member-filter";

/** What a login ID may hold; the same rule as the Tạo tài khoản form. */
export const LOGIN_ID_PATTERN = /^[a-z0-9._-]{3,30}$/;

/** Used when a name has no letter or digit left once the accents are gone. */
const FALLBACK_BASE = "thanhvien";

/** "Nguyễn Văn Đức" -> "nguyenvanduc": no accents, no spaces, at most 27 letters so "-xx" still fits in 30. */
export function loginIdBase(name: string): string {
  const base = foldText(name)
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 27);
  return base || FALLBACK_BASE;
}

/** Every "<base>-xx" the base can take, 00 to 99. */
export function loginIdOptions(base: string): string[] {
  return Array.from({ length: 100 }, (_, i) => `${base}-${String(i).padStart(2, "0")}`);
}

/**
 * A random "<base>-xx" not in `taken`. When all 100 are used, a third digit is added so the ID is still new.
 */
export function pickLoginId(base: string, taken: Set<string>): string {
  const free = loginIdOptions(base).filter((id) => !taken.has(id));
  if (free.length > 0) return free[randomInt(free.length)];
  for (;;) {
    const id = `${base}-${String(randomInt(1000)).padStart(3, "0")}`;
    if (!taken.has(id)) return id;
  }
}

// No 0/o, 1/l/i: the admin reads the password out or copies it by hand.
const PASSWORD_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
export const AUTO_PASSWORD_LENGTH = 6;

/** A first password the member is asked to change when they log in. */
export function generatePassword(length = AUTO_PASSWORD_LENGTH): string {
  return Array.from({ length }, () => PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)]).join("");
}
