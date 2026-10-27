import { notFound } from "next/navigation";
import { Suspense } from "react";
import { setScheduleActive, updateSchedule } from "@/app/actions/schedule";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { Fresh } from "@/app/ui/fresh";
import { PageHeader } from "@/app/ui/page-header";
import { loadClub } from "@/lib/club";
import { listCourts } from "@/lib/courts";
import { formatTime } from "@/lib/dates";
import { listSchedules } from "@/lib/schedule";
import { ScheduleForm } from "../../schedule-form";

async function EditSchedule({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, club } = await loadClub();
  if (!club) notFound();
  const [schedules, courts] = await Promise.all([listSchedules(club.id), listCourts(userId)]);
  const schedule = schedules.find((s) => s.id === id);
  if (!schedule) notFound();

  return (
    <div className="flex flex-col gap-6 px-5 py-6">
      <Fresh>
        <ScheduleForm
          action={updateSchedule.bind(null, schedule.id)}
          submitLabel="Lưu"
          courts={courts}
          initialValues={{
            weekday: String(schedule.weekday),
            start_time: formatTime(schedule.start_time),
            end_time: formatTime(schedule.end_time),
            court_id: schedule.court_id ?? club.court_id ?? "",
          }}
        />
      </Fresh>
      <p className="text-xs text-muted">
        Sửa giờ sẽ cập nhật các buổi sắp tới chưa điểm danh. Buổi đã điểm danh hoặc đã hủy giữ nguyên.
      </p>
      <form action={setScheduleActive.bind(null, schedule.id, !schedule.is_active)}>
        <button
          className={`h-11 w-full rounded-2xl border text-sm font-semibold ${
            schedule.is_active ? "border-amber-300 text-amber-700" : "border-brand-600 text-brand-700"
          }`}
        >
          {schedule.is_active ? "Tạm ngưng khung giờ này" : "Bật lại khung giờ này"}
        </button>
      </form>
    </div>
  );
}

export default function EditSchedulePage({ params }: PageProps<"/schedule/weekly/[id]">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Sửa khung giờ" backHref="/schedule/weekly" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <EditSchedule params={params} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
