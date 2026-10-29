import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { LOCALE_COOKIE, parseLocale, translator, type Locale, type T } from ".";

/** The language picked on this device. Reads a cookie, so call it inside <Suspense> or a server action. */
export const getLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  return parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);
});

export async function getT(): Promise<T> {
  return translator(await getLocale());
}
