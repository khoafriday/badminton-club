"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { backTarget, visit, type TrailEntry } from "@/lib/nav-trail";
import { useShellT } from "./locale";

// Lives for the tab; a full reload starts empty and ‹ then falls back to the screen one level up.
let trail: TrailEntry[] = [];

/** Records each screen opened in the app. Mounted once in the app layout. */
export function NavTrail() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    trail = visit(trail, pathname, search ? `${pathname}?${search}` : pathname);
  }, [pathname, search]);
  return null;
}

export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  const t = useShellT();
  return (
    <button
      type="button"
      onClick={() => router.push(backTarget(trail, fallback))}
      aria-label={t("Quay lại")}
      className="flex size-10 items-center justify-center text-3xl"
    >
      ‹
    </button>
  );
}
