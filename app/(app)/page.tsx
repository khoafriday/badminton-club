import Link from "next/link";
import { Suspense } from "react";
import { NoClub } from "@/app/clubs/no-club";
import { ClubSelect } from "@/app/ui/club-select";
import { ThemeToggle } from "@/app/ui/theme-toggle";
import { MemberHome } from "./member-home";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { formatVnd, monthEnd, monthStart } from "@/lib/billing";
import { getPriceSettings, listClubs, loadViewer, todayInVietnam } from "@/lib/club";
import { addDays, formatDayLabel, formatMonthLabel, formatTime } from "@/lib/dates";
import { loadDebtors } from "@/lib/debts";
import { ensureFeeSlips, waiveFullMonthAbsences } from "@/lib/fees";
import { listTransactions, summarize } from "@/lib/fund";
import { listClubCourts } from "@/lib/courts";
import { ensureSessions, listSessions } from "@/lib/schedule";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`card mx-5 p-4 ${className}`}>{children}</section>;
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [viewer, sp] = await Promise.all([loadViewer(), searchParams]);
  // A member gets their own Tổng quan; this one is the admin's. ?paid=<code>: back from a QR that was just paid.
  if (viewer.kind === "member") {
    return <MemberHome viewer={viewer} paidCode={typeof sp.paid === "string" ? sp.paid : null} />;
  }
  const { userId, club } = viewer;
  if (!club) return <NoClub />;

  const today = todayInVietnam();
  const month = { from: monthStart(today), to: monthEnd(today) };
  // The jobs that keep data current run when the app is opened (decided in Bước 3, no cron).
  // They touch different rows, so they run together.
  const [settings, { scheduleCount }] = await Promise.all([
    getPriceSettings(club.id).then(async (s) => {
      await ensureFeeSlips(club.id, today, today, s);
      return s;
    }),
    ensureSessions(club.id, today),
    waiveFullMonthAbsences(club.id, today),
  ]);

  const [sessions, transactions, debtors, clubs, courts] = await Promise.all([
    listSessions(club.id, today, addDays(today, 6)),
    listTransactions(club.id),
    loadDebtors(club.id),
    listClubs(userId),
    listClubCourts(club.id),
  ]);
  // DB-2: money collected from members this month, and what is still owed for this month.
  const collected = transactions
    .filter((t) => t.source !== "manual" && t.occurredOn >= month.from && t.occurredOn <= month.to)
    .reduce((sum, t) => sum + t.amount, 0);
  const owedThisMonth = debtors
    .flatMap((d) => d.items)
    .filter((i) => (i.kind === "fee" ? `${i.month}-01` === month.from : i.date >= month.from && i.date <= month.to))
    .reduce((sum, i) => sum + i.amount, 0);
  const owedAll = debtors.reduce((sum, d) => sum + d.total, 0);
  const balance = summarize(transactions, { from: null, to: null }).allTime.balance;
  const noPrices = Object.values(settings).every((v) => v === 0);
  const upcoming = sessions.filter((s) => s.status === "active");

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex items-center gap-3 px-5 pt-3 pb-1">
        <span className="flex size-11 items-center justify-center rounded-full bg-cta text-xl" aria-hidden>
          🏸
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{formatDayLabel(today)}</p>
          <h1 className="sr-only">{club.name}</h1>
          <ClubSelect clubs={clubs.map((c) => ({ id: c.id, name: c.name }))} currentId={club.id} variant="title" />
        </div>
        <ThemeToggle />
      </div>

      <Link href="/fund" className="hero mx-5 block p-5">
        <span className="block text-xs opacity-80">Quỹ hiện tại</span>
        <span className="mt-1 block text-[34px] leading-tight font-extrabold tracking-tight">{formatVnd(balance)}</span>
        <span className="mt-1 block text-xs opacity-85">Xem thu chi ›</span>
      </Link>

      {(noPrices || !club.court_name || scheduleCount === 0) && (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">
          <p className="font-semibold">Bắt đầu</p>
          {noPrices && (
            <p className="mt-1">
              Nhập giá phí tháng và giá vãng lai ở{" "}
              <Link href="/settings" className="font-semibold underline">
                Cài đặt
              </Link>
              .
            </p>
          )}
          {!club.court_name && (
            <p className="mt-1">
              Thêm sân cầu cho CLB ở{" "}
              <Link href="/settings" className="font-semibold underline">
                Cài đặt
              </Link>
              .
            </p>
          )}
          {scheduleCount === 0 && (
            <p className="mt-1">
              Tạo{" "}
              <Link href="/schedule/weekly" className="font-semibold underline">
                lịch cố định
              </Link>{" "}
              để app tự tạo buổi.
            </p>
          )}
        </Card>
      )}

      <div className="mx-5 mt-2 flex items-center justify-between">
        <h2 className="section-title">Buổi sắp tới</h2>
        <Link href="/schedule" className="text-xs font-bold text-brand-700">
          Xem lịch ›
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Không có buổi nào trong 7 ngày tới.</p>
        </Card>
      ) : (
        <ul className="mx-5 flex flex-col gap-2">
          {upcoming.slice(0, 4).map((s) => {
            const isToday = s.session_date === today;
            return (
              <li key={s.id}>
                <Link href={`/sessions/${s.id}`} className="card flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold tracking-tight">
                      {isToday ? "Hôm nay" : formatDayLabel(s.session_date)}
                    </span>
                    <span className="block text-xs text-muted">
                      {formatTime(s.start_time)} đến {formatTime(s.end_time)} · {s.court_name ?? club.court_name ?? ""}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      isToday ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"
                    }`}
                  >
                    Điểm danh ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {courts.length > 0 && (
        <>
          <div className="mx-5 mt-2">
            <h2 className="section-title">Sân của CLB</h2>
          </div>
          <ul className="mx-5 flex flex-col gap-2">
            {courts.map((c) => (
              <li key={c.id}>
                <Link href={`/settings/courts/${c.id}`} className="card flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold tracking-tight">{c.name}</span>
                    <span className="block truncate text-xs text-muted">{c.address ?? "Chưa có địa chỉ"}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold">
                    {c.price > 0 ? `${formatVnd(c.price)}/giờ` : "Chưa có giá"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mx-5 mt-2">
        <h2 className="section-title">{formatMonthLabel(today.slice(0, 7))}</h2>
      </div>
      <div className="mx-5 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-muted">Đã thu</p>
          <p className="mt-1 text-lg font-bold tracking-tight text-brand-700">{formatVnd(collected)}</p>
        </div>
        <Link href="/debts" className="card p-4">
          <p className="text-xs text-muted">Còn nợ ›</p>
          <p className={`mt-1 text-lg font-bold tracking-tight ${owedThisMonth > 0 ? "text-red-600" : ""}`}>
            {formatVnd(owedThisMonth)}
          </p>
        </Link>
      </div>
      {owedAll > owedThisMonth && (
        <p className="mx-5 text-xs text-muted">
          Tính cả các tháng trước: còn nợ {formatVnd(owedAll)}.{" "}
          <Link href="/debts" className="font-semibold text-brand-700">
            Xem ai nợ
          </Link>
        </p>
      )}
    </div>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <Dashboard searchParams={searchParams} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
