"use client";

import { useSyncExternalStore } from "react";
import { readThemeChoice, saveThemeChoice, type ThemeChoice } from "@/app/ui/theme";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "Theo máy" },
  { value: "light", label: "Sáng" },
  { value: "dark", label: "Tối" },
];

const CHANGE_EVENT = "themechange";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Sáng / Tối / Theo máy. The server does not know the choice, so nothing is lit until the page loads. */
export function ThemePicker() {
  const current = useSyncExternalStore(subscribe, readThemeChoice, () => null);

  return (
    <div role="radiogroup" aria-label="Giao diện" className="flex rounded-full bg-surface-2 p-1 text-sm font-semibold">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={current === o.value}
          onClick={() => {
            saveThemeChoice(o.value);
            window.dispatchEvent(new Event(CHANGE_EVENT));
          }}
          className={`h-10 flex-1 rounded-full ${current === o.value ? "bg-surface text-ink shadow-card" : "text-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
