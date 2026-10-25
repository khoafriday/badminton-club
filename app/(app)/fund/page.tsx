import Link from "next/link";
import { Suspense } from "react";
import { NoClub } from "@/app/clubs/no-club";
import { ClubPicker } from "@/app/ui/club-picker";
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
      <section className="hero mx-5 mt-1 p-5">
        <p className="text-xs opacity-80">Quỹ tồn hiện tại</p>
        <p className="mt-1 text-[34px] leading-tight font-extrabold tracking-tight">{formatVnd(allTime.balance)}</p>
        <p className="mt-1 flex gap-4 text-xs opacity-85">
          <span>↑ Thu {formatVnd(allTime.income)}</span>
          <span>↓ Chi {formatVnd(allTime.expense)}</span>
        </p>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-2 px-5">
        <Link
          href="/fund/new?type=income"
          className="flex h-12 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white"
        >
          + Ghi thu
        </Link>
        <Link
          href="/fund/new?type=expense"
          className="flex h-12 items-center justify-center rounded-full bg-cta text-sm font-bold text-on-cta"
        >
          − Ghi chi
        </Link>
      </div>
      <div className="mt-3 flex gap-2 px-5">
        <Link href="/fees" className="rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-semibold">
          Phí tháng ›
        </Link>
        <Link href="/debts" className="rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-semibold">
          Người còn nợ ›
        </Link>
      </div>

      <div className="mt-5 flex flex-col gap-3 px-5">
        <div className="flex rounded-full bg-surface-2 p-1 text-sm font-semibold">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={fundHref(p.key, date)}
              className={`flex-1 rounded-full py-2 text-center ${p.key === period ? "bg-surface text-ink shadow-card" : "text-muted"}`}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <div className="card flex items-center justify-between px-2 py-1">
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
          <p className="font-bold">{periodLabel(period, date)}</p>
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
        <div className="card grid grid-cols-3 gap-2 p-2.5 text-center">
          <div className="rounded-2xl bg-surface-2 px-1 py-2.5">
            <p className="text-xs text-muted">Tổng thu</p>
            <p className="text-sm font-bold tracking-tight text-brand-700">{formatVnd(sum.income)}</p>
          </div>
          <div className="rounded-2xl bg-surface-2 px-1 py-2.5">
            <p className="text-xs text-muted">Tổng chi</p>
            <p className="text-sm font-bold tracking-tight text-red-600">{formatVnd(sum.expense)}</p>
          </div>
          <div className="rounded-2xl bg-surface-2 px-1 py-2.5">
            <p className="text-xs text-muted">Chênh lệch</p>
            <p className="text-sm font-bold tracking-tight">{formatVnd(sum.balance)}</p>
          </div>
        </div>
      </div>

      {inRange.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">Chưa có khoản thu chi nào trong kỳ này.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2 px-5">
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
                className="card flex items-center gap-3 px-3 py-2.5 active:bg-surface-2"
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                    r.type === "income" ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-600"
                  }`}
                  aria-hidden
                >
                  {r.type === "income" ? "↑" : "↓"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.description || r.category}</span>
                  <span className="block truncate text-xs text-muted">
                    {[
                      formatShortDate(r.occurredOn),
                      r.description ? r.category : null,
                      r.source !== "manual" ? "Tự ghi khi bấm Đã nộp" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className={`text-sm font-bold ${r.type === "income" ? "text-brand-700" : "text-red-600"}`}>
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
      <PageHeader
        title="Quỹ"
        right={
          <Suspense>
            <ClubPicker />
          </Suspense>
        }
      />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <FundContent searchParams={searchParams} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
