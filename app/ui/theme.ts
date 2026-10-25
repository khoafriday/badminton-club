// Cài đặt > Giao diện. The choice is kept per device in localStorage, not in the database.
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "theme";

/**
 * Runs in <head> before the first paint: sets <html data-theme> from the saved choice, and keeps
 * following the phone while the choice is "system". Must stay self-contained (it is inlined as text).
 */
export const themeScript = `(function(){try{var m=matchMedia("(prefers-color-scheme: dark)");var a=window.__applyTheme=function(){var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=m.matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)};a();m.addEventListener("change",a)}catch(e){}})()`;

declare global {
  interface Window {
    __applyTheme?: () => void;
  }
}

export function readThemeChoice(): ThemeChoice {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function saveThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private mode or blocked storage: the choice still applies until the page reloads.
  }
  if (window.__applyTheme) window.__applyTheme();
  else document.documentElement.setAttribute("data-theme", choice === "dark" ? "dark" : "light");
}
