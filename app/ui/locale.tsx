"use client";

import { createContext, use, useSyncExternalStore } from "react";
import { translator, type Locale, type T } from "@/lib/i18n";

// The root layout hands over the cookie read as a promise, so the static parts of a page are not held back by it.
const LocaleContext = createContext<Promise<Locale>>(Promise.resolve("vi"));

export function LocaleProvider({ locale, children }: { locale: Promise<Locale>; children: React.ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

/** Suspends until the request's language is known, so the component must sit inside <Suspense>. */
export function useLocale(): Locale {
  return use(use(LocaleContext));
}

export function useT(): T {
  return translator(useLocale());
}

const CHANGE_EVENT = "langchange";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/**
 * The language on <html lang>, set by the <head> script from the cookie, read without suspending.
 * The server's copy is Vietnamese.
 */
export function useDocumentLocale(): Locale {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.lang === "en" ? "en" : "vi"),
    () => "vi",
  );
}

/** Switches <html lang> at once: every <Bi> text and useShellT() follow before the server has answered. */
export function setDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For the few client parts drawn before the request is known, such as the ‹ button and the login form. */
export function useShellT(): T {
  return translator(useDocumentLocale());
}
