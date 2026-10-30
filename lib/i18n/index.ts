// Vietnamese is the app's language and the source text; English is a lookup on top of it.
// Every string in the UI is written in Vietnamese and passed through t(). A string without an English entry
// shows in Vietnamese, so a screen never breaks when a new string has not been translated yet.
import { EN } from "./en";

export type Locale = "vi" | "en";

export const LOCALES: Locale[] = ["vi", "en"];

/** Kept per device like the Sáng/Tối choice. Readable by the <head> script, so not httpOnly. */
export const LOCALE_COOKIE = "lang";

export function parseLocale(value: string | undefined | null): Locale {
  return value === "en" ? "en" : "vi";
}

export type Vars = Record<string, string | number>;

/**
 * t("Còn nợ {amount}", { amount: "50.000đ" }). An English entry may hold "singular|plural",
 * picked by vars.count: "{count} buổi" -> "{count} session|{count} sessions".
 * vars.context picks an entry "text@context" when one Vietnamese word needs two English ones.
 */
export type T = (text: string, vars?: Vars) => string;

export function translate(locale: Locale, text: string, vars?: Vars): string {
  let s = text;
  if (locale === "en") {
    const context = vars?.context;
    s = (context !== undefined ? EN[`${text}@${context}`] : undefined) ?? EN[text] ?? text;
  }
  if (!vars) return s;
  if (s.includes("|") && "count" in vars) {
    const [one, many] = s.split("|");
    s = Number(vars.count) === 1 ? one : many;
  }
  return s.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export function translator(locale: Locale): T {
  return (text, vars) => translate(locale, text, vars);
}

/** The English text for the parts of a screen rendered before the request is known (see app/ui/bi.tsx). */
export function englishOf(text: string): string {
  return EN[text] ?? text;
}

/**
 * Runs in <head> before the first paint: sets <html lang> from the cookie, so the CSS in globals.css can pick
 * the right half of each <Bi> text. Must stay self-contained (it is inlined as text).
 */
export const localeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=([^;]*)/);document.documentElement.lang=m&&m[1]==="en"?"en":"vi"}catch(e){}})()`;
