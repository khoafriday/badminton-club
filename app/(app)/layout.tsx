import { Suspense } from "react";
import { NavTrail } from "@/app/ui/back-button";
import { BottomNav, NavBar } from "@/app/ui/bottom-nav";
import { currentUser } from "@/lib/session";

/** The menu for whoever is signed in: members get fewer tabs. */
async function RoleNav() {
  const user = await currentUser();
  return <BottomNav member={user?.kind === "member"} />;
}

// Every signed-in screen shares the bottom menu; the login page sits outside this group.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="flex flex-1 flex-col pb-32">{children}</div>
      <Suspense>
        <NavTrail />
      </Suspense>
      <Suspense fallback={<NavBar pathname={null} />}>
        <RoleNav />
      </Suspense>
    </>
  );
}
