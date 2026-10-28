"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchClub } from "@/app/actions/settings";

/**
 * A link to a screen of another club (for example a session in the Lịch "Tất cả" list).
 * Screens show the current club only, so it makes that club current first, then opens the screen.
 */
export function SwitchClubLink({
  clubId,
  href,
  className,
  children,
}: {
  clubId: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <a
      href={href}
      aria-busy={pending}
      onClick={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await switchClub(clubId);
          router.push(href);
        });
      }}
      className={`${className ?? ""} ${pending ? "opacity-60" : ""}`}
    >
      {children}
    </a>
  );
}
