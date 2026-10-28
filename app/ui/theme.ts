// The Sáng/Tối toggle on Tổng quan. The choice is kept per device in localStorage, not in the database.
export type Theme = "light" | "dark";

export const THEME_KEY = "theme";

const THEME_COLOR: Record<Theme, string> = { light: "#f8faf9", dark: "#0c110f" };

/**
 * Runs in <head> before the first paint: sets <html data-theme> from the saved choice, Sáng unless Tối was
 * picked, and colours the phone's status bar to match. Must stay self-contained (it is inlined as text).
 */
export const themeScript = `(function(){try{var a=window.__applyTheme=function(){var t=localStorage.getItem("${THEME_KEY}")==="dark"?"dark":"light";document.documentElement.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"${THEME_COLOR.dark}":"${THEME_COLOR.light}")};a();document.addEventListener("DOMContentLoaded",a)}catch(e){}})()`;

export const LIGHT_THEME_COLOR = THEME_COLOR.light;

declare global {
  interface Window {
    __applyTheme?: () => void;
  }
}

export function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function saveTheme(theme: Theme) {
  try {
    if (theme === "light") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice still applies until the page reloads.
  }
  if (window.__applyTheme) window.__applyTheme();
  else document.documentElement.setAttribute("data-theme", theme);
}
