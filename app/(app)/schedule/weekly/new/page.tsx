import { Suspense } from "react";
import { createSchedule } from "@/app/actions/schedule";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { Fresh } from "@/app/ui/fresh";
import { PageHeader } from "@/app/ui/page-header";
import { loadClub } from "@/lib/club";
import { getT } from "@/lib/i18n/server";
import { listCourts } from "@/lib/courts";
import { ScheduleForm } from "../../schedule-form";

async function NewSchedule() {
  const { userId, club } = await loadClub();
  if (!club) {
    return (
      <>
        <PageHeader title="Thêm khung giờ" backHref="/schedule/weekly" />
        <NoClub />
      </>
    );
  }
  const [courts, t] = await Promise.all([listCourts(userId), getT()]);
  return (
    <>
      <PageHeader title={t("Thêm khung giờ cho CLB {name}", { name: club.name })} backHref="/schedule/weekly" />
      <div className="px-5 py-6">
        <Fresh>
          <ScheduleForm
            action={createSchedule}
            submitLabel="Thêm khung giờ"
            courts={courts}
            initialValues={{ weekday: "", start_time: "19:00", end_time: "21:00", court_id: club.court_id ?? "" }}
          />
        </Fresh>
      </div>
    </>
  );
}

export default function NewSchedulePage() {
  return (
    <main className="flex flex-1 flex-col">
      {/* The title names the club, so it is drawn once the club is loaded. */}
      <Suspense
        fallback={
          <>
            <PageHeader title="Thêm khung giờ" backHref="/schedule/weekly" />
            <Loading />
          </>
        }
      >
        <RequireDatabase>
          <NewSchedule />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
