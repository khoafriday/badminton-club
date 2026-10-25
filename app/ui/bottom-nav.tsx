"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Tổng quan", icon: "🏠" },
  { href: "/schedule", label: "Lịch", icon: "📅" },
  { href: "/members", label: "Thành viên", icon: "👥" },
  { href: "/fund", label: "Quỹ", icon: "💰" },
  { href: "/settings", label: "Cài đặt", icon: "⚙️" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // A session belongs to the Lịch tab.
  if (href === "/schedule") return pathname.startsWith("/schedule") || pathname.startsWith("/sessions");
  return pathname.startsWith(href);
}

/** Reads the URL, so it must sit inside <Suspense>; the fallback is the same menu with no tab lit. */
export function BottomNav() {
  return <NavBar pathname={usePathname()} />;
}

export function NavBar({ pathname }: { pathname: string | null }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-md border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const active = pathname !== null && isActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              active ? "text-brand-700" : "text-zinc-500"
            }`}
          >
            <span className={`text-xl ${active ? "" : "opacity-60 grayscale"}`} aria-hidden>
              {tab.icon}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
