import Link from "next/link";
import { Suspense } from "react";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { formatVnd } from "@/lib/billing";
import { loadViewer } from "@/lib/club";
import { formatFullDate } from "@/lib/dates";
import { translator, type Locale } from "@/lib/i18n";
import { feeMonthLabel, sessionDayLabel } from "@/lib/i18n/labels";
import { getLocale } from "@/lib/i18n/server";
import { accountMemberships } from "@/lib/member-accounts";
import { loadPaymentHistory } from "@/lib/member-history";
import type { PaymentEntry } from "@/lib/payment-history";

const METHOD_LABEL = { cash: "Tiền mặt", transfer: "Chuyển khoản" } as const;

function entryLabel(e: PaymentEntry, locale: Locale) {
  return e.kind === "fee" ? feeMonthLabel(e.period, locale) : sessionDayLabel(e.period, locale);
}

/** Lịch sử đóng phí: every payment the member made, in all their clubs or in one. Read only. */
async function HistoryContent({ searchParams }: { searchParams: PageProps<"/history">["searchParams"] }) {
  const [sp, viewer, locale] = await Promise.all([searchParams, loadViewer(), getLocale()]);
  const t = translator(locale);
  if (viewer.kind !== "member") {
    return <p className="card mx-5 p-4 text-sm text-muted">{t("Màn này dành cho thành viên.")}</p>;
  }
  const { clubs } = viewer;
  const memberships = await accountMemberships(viewer.accountId);
  const clubId = typeof sp.club === "string" && clubs.some((c) => c.id === sp.club) ? sp.club : null;
  const entries = (await loadPaymentHistory(memberships.map((m) => m.memberId))).filter(
    (e) => !clubId || e.clubId === clubId,
  );
  const clubName = new Map(clubs.map((c) => [c.id, c.name]));
  // The club only matters when several are listed together.
  const detail = (e: PaymentEntry) =>
    [!clubId && clubs.length > 1 ? clubName.get(e.clubId) : null, e.method && t(METHOD_LABEL[e.method])]
      .filter(Boolean)
      .join(" · ");
  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  // One group per day the money came in; parts paid before a fee rise have no day of their own.
  const groups: { day: string | null; entries: PaymentEntry[] }[] = [];
  for (const e of entries) {
    const last = groups.at(-1);
    if (last && last.day === e.paidOn) last.entries.push(e);
    else groups.push({ day: e.paidOn, entries: [e] });
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      {clubs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-5 pb-1 text-sm font-semibold">
          {[{ id: null, name: t("Tất cả") }, ...clubs].map((c) => (
            <Link
              key={c.id ?? "all"}
              href={c.id ? `/history?club=${c.id}` : "/history"}
              className={`shrink-0 rounded-full px-4 py-2 ${
                c.id === clubId ? "bg-cta text-on-cta" : "bg-surface-2 text-muted"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}
      <section className="card mx-5 p-4">
        <p className="text-xs text-muted">{clubId ? t("Đã đóng cho CLB {club}", { club: clubName.get(clubId) ?? "" }) : t("Tổng đã đóng")}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-brand-700">{formatVnd(total)}</p>
        <p className="mt-1 text-xs text-muted">{t("{count} khoản", { count: entries.length })}</p>
      </section>
      {groups.length === 0 ? (
        <p className="card mx-5 p-4 text-sm text-muted">{t("Chưa có lần đóng phí nào.")}</p>
      ) : (
        groups.map((g) => (
          <section key={g.day ?? "earlier"} className="flex flex-col gap-2">
            <h2 className="section-title mx-5 mt-2">{g.day ? formatFullDate(g.day) : t("Đóng trước khi tăng phí")}</h2>
            <ul className="mx-5 flex flex-col gap-2">
              {g.entries.map((e) => (
                <li key={e.key} className="card flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold tracking-tight">{entryLabel(e, locale)}</span>
                    {detail(e) && <span className="block truncate text-xs text-muted">{detail(e)}</span>}
                  </span>
                  <span className="shrink-0 font-semibold text-brand-700">{formatVnd(e.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

export default function HistoryPage({ searchParams }: PageProps<"/history">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Lịch sử đóng phí" backHref="/" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <HistoryContent searchParams={searchParams} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
