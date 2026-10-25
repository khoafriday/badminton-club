import { Suspense } from "react";
import { ClubForm } from "@/app/clubs/club-form";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { requireUser } from "@/lib/club";
import { listCourts } from "@/lib/courts";

async function NewClub() {
  const courts = await listCourts(await requireUser());
  return (
    <div className="px-5 py-6">
      <ClubForm courts={courts} redirectTo="/settings" />
    </div>
  );
}

export default function NewClubPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Tạo CLB mới" backHref="/settings" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <NewClub />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
