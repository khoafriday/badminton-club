import { Suspense } from "react";
import { NavTrail } from "@/app/ui/back-button";
import { BottomNav, NavBar } from "@/app/ui/bottom-nav";

// Every signed-in screen shares the bottom menu; the login page sits outside this group.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="flex flex-1 flex-col pb-32">{children}</div>
      <Suspense>
        <NavTrail />
      </Suspense>
      <Suspense fallback={<NavBar pathname={null} />}>
        <BottomNav />
      </Suspense>
    </>
  );
}
