import { Suspense } from "react";
import { createSchedule } from "@/app/actions/schedule";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { loadClub } from "@/lib/club";
import { listCourts } from "@/lib/courts";
import { ScheduleForm } from "../../schedule-form";

async function NewSchedule() {
  const { userId, club } = await loadClub();
  if (!club) return <NoClub />;
  const courts = await listCourts(userId);
  return (
    <div className="px-5 py-6">
      <ScheduleForm
        action={createSchedule}
        submitLabel="Thêm khung giờ"
        courts={courts}
        initialValues={{ weekday: "", start_time: "19:00", end_time: "21:00", court_id: club.court_id ?? "" }}
      />
    </div>
  );
}

export default function NewSchedulePage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Thêm khung giờ" backHref="/schedule/weekly" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <NewSchedule />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
