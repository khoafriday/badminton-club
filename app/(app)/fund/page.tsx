import Link from "next/link";
import { Suspense } from "react";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { formatVnd, periodRange, type FundPeriod } from "@/lib/billing";
import { loadClub, todayInVietnam } from "@/lib/club";
import { addMonths, formatMonthLabel, formatShortDate } from "@/lib/dates";
import { listTransactions, summarize } from "@/lib/fund";

const PERIODS: { key: FundPeriod; label: string }[] = [
  { key: "month", label: "Tháng" },
  { key: "quarter", label: "Quý" },
  { key: "all", label: "Toàn bộ" },
];

function fundHref(period: FundPeriod, date: string) {
  return period === "all" ? "/fund?period=all" : `/fund?period=${period}&date=${date}`;
}

function periodLabel(period: FundPeriod, date: string) {
  if (period === "month") return formatMonthLabel(date.slice(0, 7));
  if (period === "quarter") return `Quý ${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}/${date.slice(0, 4)}`;
  return "Từ trước tới nay";
}

async function FundContent({ searchParams }: { searchParams: PageProps<"/fund">["searchParams"] }) {
  const sp = await searchParams;
  const { club } = await loadClub();
  if (!club) return <NoClub />;

  const today = todayInVietnam();
  const period: FundPeriod = sp.period === "quarter" || sp.period === "all" ? sp.period : "month";
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const step = period === "quarter" ? 3 : 1;
  const prev = `${addMonths(date.slice(0, 7), -step)}-01`;
  const next = `${addMonths(date.slice(0, 7), step)}-01`;

  const range = periodRange(period, date);
  const rows = await listTransactions(club.id);
  const { period: sum, allTime } = summarize(rows, range);
  const inRange = rows.filter(
    (r) => (!range.from || r.occurredOn >= range.from) && (!range.to || r.occurredOn <= range.to),
  );

  return (
    <>
      <section className="mx-5 mt-4 rounded-xl bg-brand-600 p-4 text-white">
        <p className="text-sm opacity-90">Quỹ tồn hiện tại</p>
        <p className="text-3xl font-bold">{formatVnd(allTime.balance)}</p>
      </section>

      <div className="mt-4 flex flex-col gap-3 px-5">
        <div className="flex rounded-lg bg-zinc-100 p-1 text-sm font-medium">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={fundHref(p.key, date)}
              className={`flex-1 rounded-md py-1.5 text-center ${p.key === period ? "bg-white shadow-sm" : "text-zinc-500"}`}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-between">
          {period === "all" ? (
            <span className="size-10" />
          ) : (
            <Link
              href={fundHref(period, prev)}
              aria-label="Trước"
              className="flex size-10 items-center justify-center text-2xl"
            >
              ‹
            </Link>
          )}
          <p className="font-semibold">{periodLabel(period, date)}</p>
          {period === "all" ? (
            <span className="size-10" />
          ) : (
            <Link
              href={fundHref(period, next)}
              aria-label="Sau"
              className="flex size-10 items-center justify-center text-2xl"
            >
              ›
            </Link>
          )}
        </div>
        <div className="grid grid-cols-3 rounded-xl border border-zinc-200 p-3 text-center">
          <div>
            <p className="text-xs text-zinc-500">Tổng thu</p>
            <p className="font-bold text-brand-700">{formatVnd(sum.income)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Tổng chi</p>
            <p className="font-bold text-red-600">{formatVnd(sum.expense)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Chênh lệch</p>
            <p className="font-bold">{formatVnd(sum.balance)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/fund/new?type=expense"
            className="flex h-11 items-center justify-center rounded-lg border-2 border-red-200 text-sm font-semibold text-red-600"
          >
            − Ghi khoản chi
          </Link>
          <Link
            href="/fund/new?type=income"
            className="flex h-11 items-center justify-center rounded-lg border-2 border-brand-600 text-sm font-semibold text-brand-700"
          >
            + Ghi khoản thu
          </Link>
        </div>
      </div>

      {inRange.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">Chưa có khoản thu chi nào trong kỳ này.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
          {inRange.map((r) => (
            <li key={r.id}>
              <Link
                href={
                  r.source === "manual"
                    ? `/fund/${r.id}`
                    : r.sessionId
                      ? `/sessions/${r.sessionId}`
                      : `/fees?month=${r.occurredOn.slice(0, 7)}`
                }
                className="flex items-center gap-3 px-5 py-3 active:bg-zinc-50"
              >
                <span className="w-12 shrink-0 text-xs text-zinc-500">{formatShortDate(r.occurredOn)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.category}</span>
                  {r.description && <span className="block truncate text-xs text-zinc-500">{r.description}</span>}
                  {r.source !== "manual" && <span className="block text-xs text-zinc-400">Tự ghi khi bấm Đã nộp</span>}
                </span>
                <span className={`text-sm font-semibold ${r.type === "income" ? "text-brand-700" : "text-red-600"}`}>
                  {r.type === "income" ? "+" : "−"}
                  {formatVnd(r.amount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function FundPage({ searchParams }: PageProps<"/fund">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Quỹ" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <FundContent searchParams={searchParams} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
