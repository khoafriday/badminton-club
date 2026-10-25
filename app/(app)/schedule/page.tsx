import Link from "next/link";
import { Suspense } from "react";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Fab } from "@/app/ui/fab";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { loadClub, todayInVietnam } from "@/lib/club";
import {
  addDays,
  addMonths,
  formatDayLabel,
  formatMonthLabel,
  formatShortDate,
  formatTime,
  mondayOf,
} from "@/lib/dates";
import { monthEnd } from "@/lib/billing";
import { ensureSessions, listSessions, type SessionRow } from "@/lib/schedule";

type View = "week" | "month";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function scheduleHref(view: View, date: string) {
  return view === "week" ? `/schedule?date=${date}` : `/schedule?view=month&date=${date}`;
}

async function ScheduleContent({ searchParams }: { searchParams: PageProps<"/schedule">["searchParams"] }) {
  const sp = await searchParams;
  const { club } = await loadClub();
  if (!club) return <NoClub />;

  const today = todayInVietnam();
  const view: View = sp.view === "month" ? "month" : "week";
  const anchor = typeof sp.date === "string" && ISO_DATE.test(sp.date) ? sp.date : today;

  let from: string, to: string, label: string, prev: string, next: string;
  if (view === "week") {
    from = mondayOf(anchor);
    to = addDays(from, 6);
    label = `${formatShortDate(from)} đến ${formatShortDate(to)}`;
    prev = addDays(from, -7);
    next = addDays(from, 7);
  } else {
    const month = anchor.slice(0, 7);
    from = `${month}-01`;
    to = monthEnd(from);
    label = formatMonthLabel(month);
    prev = `${addMonths(month, -1)}-01`;
    next = `${addMonths(month, 1)}-01`;
  }

  const { scheduleCount } = await ensureSessions(club.id, today);
  const sessions = await listSessions(club.id, from, to);
  const byDate = new Map<string, SessionRow[]>();
  for (const s of sessions) byDate.set(s.session_date, [...(byDate.get(s.session_date) ?? []), s]);

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-zinc-100 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex rounded-lg bg-zinc-100 p-1 text-sm font-medium">
            {(["week", "month"] as const).map((v) => (
              <Link
                key={v}
                href={scheduleHref(v, anchor)}
                className={`rounded-md px-4 py-1.5 ${v === view ? "bg-white shadow-sm" : "text-zinc-500"}`}
              >
                {v === "week" ? "Tuần" : "Tháng"}
              </Link>
            ))}
          </div>
          <Link href="/schedule/weekly" className="text-sm font-semibold text-brand-700">
            Lịch tuần ›
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <Link href={scheduleHref(view, prev)} aria-label="Trước" className="flex size-10 items-center justify-center text-2xl">
            ‹
          </Link>
          <div className="text-center">
            <p className="font-semibold">{label}</p>
            {(today < from || today > to) && (
              <Link href={scheduleHref(view, today)} className="text-xs text-brand-700">
                Về hôm nay
              </Link>
            )}
          </div>
          <Link href={scheduleHref(view, next)} aria-label="Sau" className="flex size-10 items-center justify-center text-2xl">
            ›
          </Link>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-zinc-500">
          <p>Không có buổi nào {view === "week" ? "trong tuần này" : "trong tháng này"}.</p>
          {scheduleCount === 0 && (
            <p className="mt-1">
              Tạo <Link href="/schedule/weekly" className="font-semibold text-brand-700">lịch tuần</Link> để app tự
              tạo buổi, hoặc bấm + để thêm buổi lẻ.
            </p>
          )}
        </div>
      ) : (
        <ul>
          {[...byDate].map(([date, daySessions]) => (
            <li key={date} className="border-b border-zinc-100 px-5 py-3">
              <p className={`text-sm font-semibold ${date === today ? "text-brand-700" : "text-zinc-500"}`}>
                {formatDayLabel(date)}
                {date === today && " · Hôm nay"}
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {daySessions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/sessions/${s.id}`}
                      className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 active:bg-zinc-50"
                    >
                      <span className={`flex-1 ${s.status === "cancelled" ? "text-zinc-400 line-through" : ""}`}>
                        <span className="font-medium">
                          {formatTime(s.start_time)} đến {formatTime(s.end_time)}
                        </span>
                        <span className="block text-xs text-zinc-500">
                          {s.venue_name ?? club.venue_name ?? "Chưa có sân"}
                          {s.schedule_id ? "" : " · Buổi lẻ"}
                        </span>
                      </span>
                      {s.status === "cancelled" && (
                        <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">Hủy</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <Fab href={`/schedule/new?date=${anchor < today ? today : anchor}`} label="Thêm buổi lẻ" />
    </>
  );
}

export default function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Lịch" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <ScheduleContent searchParams={searchParams} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
