"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, parseLocale } from "@/lib/i18n";

/** Tiếng Việt / English switch. Every screen is drawn again in the new language. */
export async function setLocale(value: string) {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, parseLocale(value), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
