import Link from "next/link";
import { Suspense } from "react";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Fab } from "@/app/ui/fab";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { loadClub } from "@/lib/club";
import { WEEKDAY_LABEL, formatTime } from "@/lib/dates";
import { listSchedules } from "@/lib/schedule";

async function WeeklyContent() {
  const { club } = await loadClub();
  if (!club) return <NoClub />;
  const schedules = await listSchedules(club.id);

  return (
    <>
      <p className="px-5 pt-1 text-sm text-muted">App tự tạo buổi cho 4 tuần tới theo các khung giờ này.</p>
      {schedules.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">Chưa có lịch cố định. Bấm + để thêm.</p>
      ) : (
        <ul className="flex flex-col gap-2 px-5 py-4">
          {schedules.map((s) => (
            <li key={s.id}>
              <Link
                href={`/schedule/weekly/${s.id}`}
                className="card flex items-center gap-3 px-3 py-3 active:bg-surface-2"
              >
                <span
                  className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${
                    s.is_active ? "bg-cta text-on-cta" : "bg-surface-2 text-faint"
                  }`}
                  aria-hidden
                >
                  {WEEKDAY_LABEL[s.weekday].replace("Thứ ", "T").replace("Chủ nhật", "CN")}
                </span>
                <span className={`flex-1 ${s.is_active ? "" : "text-faint"}`}>
                  <span className="font-bold">{WEEKDAY_LABEL[s.weekday]} hằng tuần</span>
                  <span className="block text-xs text-muted">
                    {formatTime(s.start_time)} đến {formatTime(s.end_time)} · {s.court_name ?? club.court_name ?? "Chưa có sân"}
                  </span>
                </span>
                {!s.is_active && (
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">Tạm ngưng</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Fab href="/schedule/weekly/new" label="Thêm khung giờ" />
    </>
  );
}

export default function WeeklySchedulePage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Lịch cố định" backHref="/schedule" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <WeeklyContent />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
