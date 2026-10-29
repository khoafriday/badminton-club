"use client";

import { useSyncExternalStore } from "react";
import { useShellT } from "@/app/ui/locale";
import { readTheme, saveTheme } from "@/app/ui/theme";

const CHANGE_EVENT = "themechange";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Sáng/Tối switch at the top of Tổng quan. The server does not know the choice, so it renders as Sáng. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, () => readTheme() === "dark", () => false);
  const t = useShellT();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={t("Giao diện tối")}
      title={t(dark ? "Đang tối, bấm để chuyển sáng" : "Đang sáng, bấm để chuyển tối")}
      onClick={() => {
        saveTheme(dark ? "light" : "dark");
        window.dispatchEvent(new Event(CHANGE_EVENT));
      }}
      className="relative flex h-9 w-16 shrink-0 items-center rounded-full bg-surface-2 p-1"
    >
      <span
        className={`flex size-7 items-center justify-center rounded-full bg-surface text-sm shadow-card transition-transform ${
          dark ? "translate-x-7" : ""
        }`}
        aria-hidden
      >
        {dark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}
