import { englishOf } from "@/lib/i18n";

/**
 * Text in the part of a screen drawn before the request is known (page titles, the menu, loading).
 * Both languages are sent and globals.css hides one by <html lang>, so it never flashes the wrong one.
 * Anywhere else, use t() from getT() or useT().
 */
export function Bi({ text }: { text: string }) {
  const en = englishOf(text);
  if (en === text) return text;
  return (
    <>
      <span className="lang-vi">{text}</span>
      <span className="lang-en">{en}</span>
    </>
  );
}
