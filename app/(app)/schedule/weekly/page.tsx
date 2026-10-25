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
      <p className="px-5 pt-4 text-sm text-zinc-500">App tự tạo buổi cho 4 tuần tới theo các khung giờ này.</p>
      {schedules.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">Chưa có lịch tuần. Bấm + để thêm.</p>
      ) : (
        <ul className="flex flex-col gap-2 px-5 py-4">
          {schedules.map((s) => (
            <li key={s.id}>
              <Link
                href={`/schedule/weekly/${s.id}`}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-3 active:bg-zinc-50"
              >
                <span className={`flex-1 ${s.is_active ? "" : "text-zinc-400"}`}>
                  <span className="font-semibold">{WEEKDAY_LABEL[s.weekday]}</span>
                  <span className="block text-sm">
                    {formatTime(s.start_time)} đến {formatTime(s.end_time)} · {s.court_name ?? club.court_name ?? "Chưa có sân"}
                  </span>
                </span>
                {!s.is_active && (
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">Tạm ngưng</span>
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
      <PageHeader title="Lịch tuần" backHref="/schedule" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <WeeklyContent />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
