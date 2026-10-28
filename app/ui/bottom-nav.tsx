"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Spinner } from "./loading";

const ADMIN_TABS = [
  { href: "/", label: "Tổng quan", icon: "🏠" },
  { href: "/schedule", label: "Lịch", icon: "📅" },
  { href: "/members", label: "Thành viên", icon: "👥" },
  { href: "/fund", label: "Quỹ", icon: "💰" },
  { href: "/settings", label: "Cài đặt", icon: "⚙️" },
];

// TK-4: a member looks at three screens, plus their own account (password, sign out).
const MEMBER_TABS = [
  { href: "/", label: "Tổng quan", icon: "🏠" },
  { href: "/schedule", label: "Lịch", icon: "📅" },
  { href: "/fund", label: "Quỹ", icon: "💰" },
  { href: "/account", label: "Tài khoản", icon: "👤" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/debts");
  // A session belongs to the Lịch tab.
  if (href === "/schedule") return pathname.startsWith("/schedule") || pathname.startsWith("/sessions");
  // Monthly fees are reached from the Members screen.
  if (href === "/members") return pathname.startsWith("/members") || pathname.startsWith("/fees");
  return pathname.startsWith(href);
}

/** The tab's icon, swapped for a spinner while the tapped screen is still on its way. */
function TabIcon({ icon, active }: { icon: string; active: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) return <Spinner className="size-[18px]" />;
  return (
    <span className={`text-lg leading-none ${active ? "" : "opacity-70 brightness-150 grayscale"}`} aria-hidden>
      {icon}
    </span>
  );
}

/** Reads the URL, so it must sit inside <Suspense>; the fallback is the same menu with no tab lit. */
export function BottomNav({ member = false }: { member?: boolean }) {
  return <NavBar pathname={usePathname()} member={member} />;
}

export function NavBar({ pathname, member = false }: { pathname: string | null; member?: boolean }) {
  const tabs = member ? MEMBER_TABS : ADMIN_TABS;
  return (
    <nav className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mx-auto w-full max-w-md px-4">
      <div className="flex gap-1 rounded-[28px] bg-nav p-1.5 shadow-hero backdrop-blur">
        {tabs.map((tab) => {
          const active = pathname !== null && isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[10.5px] font-medium ${
                active ? "bg-brand-600 text-white" : "text-nav-text"
              }`}
            >
              <TabIcon icon={tab.icon} active={active} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
