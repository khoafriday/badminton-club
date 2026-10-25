import Link from "next/link";
import { Suspense } from "react";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { formatVnd, monthEnd, monthStart } from "@/lib/billing";
import { getPriceSettings, loadClub, todayInVietnam } from "@/lib/club";
import { addDays, formatDayLabel, formatMonthLabel, formatTime } from "@/lib/dates";
import { loadDebtors } from "@/lib/debts";
import { ensureFeeSlips, waiveFullMonthAbsences } from "@/lib/fees";
import { listTransactions, summarize } from "@/lib/fund";
import { ensureSessions, listSessions } from "@/lib/schedule";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-5 rounded-xl border border-zinc-200 p-4 ${className}`}>{children}</section>;
}

async function Dashboard() {
  const { club } = await loadClub();
  if (!club) return <NoClub />;

  const today = todayInVietnam();
  const month = { from: monthStart(today), to: monthEnd(today) };
  const settings = await getPriceSettings(club.id);
  // The jobs that keep data current run when the app is opened (decided in Bước 3, no cron).
  const { scheduleCount } = await ensureSessions(club.id, today);
  await ensureFeeSlips(club.id, today, today, settings);
  await waiveFullMonthAbsences(club.id, today);

  const [sessions, transactions, debtors] = await Promise.all([
    listSessions(club.id, today, addDays(today, 6)),
    listTransactions(club.id),
    loadDebtors(club.id),
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
    <div className="flex flex-col gap-4 py-4">
      <p className="px-5 text-sm text-zinc-500">
        {club.name} · {formatDayLabel(today)}
      </p>

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
                lịch tuần
              </Link>{" "}
              để app tự tạo buổi.
            </p>
          )}
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Buổi sắp tới</h2>
          <Link href="/schedule" className="text-sm font-semibold text-brand-700">
            Lịch ›
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Không có buổi nào trong 7 ngày tới.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {upcoming.slice(0, 4).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sessions/${s.id}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                    s.session_date === today ? "bg-brand-600 text-white" : "bg-zinc-50"
                  }`}
                >
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">
                      {s.session_date === today ? "Hôm nay" : formatDayLabel(s.session_date)}
                    </span>
                    <span className="block text-xs opacity-80">
                      {formatTime(s.start_time)} đến {formatTime(s.end_time)} · {s.court_name ?? club.court_name ?? ""}
                    </span>
                  </span>
                  <span className="text-sm font-semibold">Điểm danh ›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-bold">{formatMonthLabel(today.slice(0, 7))}</h2>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-zinc-500">Đã thu</p>
            <p className="text-lg font-bold text-brand-700">{formatVnd(collected)}</p>
          </div>
          <Link href="/debts">
            <p className="text-xs text-zinc-500">Còn nợ ›</p>
            <p className={`text-lg font-bold ${owedThisMonth > 0 ? "text-amber-600" : ""}`}>
              {formatVnd(owedThisMonth)}
            </p>
          </Link>
        </div>
        {owedAll > owedThisMonth && (
          <p className="mt-2 text-xs text-zinc-500">
            Tính cả các tháng trước: còn nợ {formatVnd(owedAll)}.{" "}
            <Link href="/debts" className="font-semibold text-brand-700">
              Xem ai nợ
            </Link>
          </p>
        )}
      </Card>

      <Link href="/fund" className="mx-5 flex items-center justify-between rounded-xl bg-brand-600 p-4 text-white">
        <span>
          <span className="block text-sm opacity-90">Quỹ tồn</span>
          <span className="block text-2xl font-bold">{formatVnd(balance)}</span>
        </span>
        <span className="text-sm font-semibold">Quỹ ›</span>
      </Link>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex h-14 items-center border-b border-zinc-100 px-5">
        <h1 className="text-lg font-bold">🏸 Badminton Club</h1>
      </header>
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <Dashboard />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
