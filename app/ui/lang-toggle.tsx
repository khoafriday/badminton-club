"use client";

import { useOptimistic, useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { LOCALES } from "@/lib/i18n";
import { setDocumentLocale, useDocumentLocale } from "./locale";

/** Tiếng Việt / English switch next to Sáng/Tối. The choice is kept on this device (cookie), Tiếng Việt by default. */
export function LangToggle() {
  const [locale, setOptimistic] = useOptimistic(useDocumentLocale());
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="radiogroup"
      aria-label="Ngôn ngữ / Language"
      className={`flex h-9 shrink-0 items-center rounded-full bg-surface-2 p-1 ${pending ? "opacity-70" : ""}`}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={locale === l}
          disabled={pending}
          onClick={() => {
            if (l === locale) return;
            startTransition(async () => {
              setOptimistic(l);
              // Page titles and the menu switch at once; the rest arrives with the new render.
              setDocumentLocale(l);
              await setLocale(l);
            });
          }}
          className={`h-7 rounded-full px-2.5 text-xs font-bold ${
            locale === l ? "bg-surface text-ink shadow-card" : "text-muted"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
