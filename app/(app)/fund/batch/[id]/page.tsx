import { notFound } from "next/navigation";
import { Suspense } from "react";
import { undoMemberFees } from "@/app/actions/fund";
import { ConfirmButton } from "@/app/ui/confirm-button";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { formatVnd } from "@/lib/billing";
import { loadClub } from "@/lib/club";
import { formatMonthLabel, formatShortDate } from "@/lib/dates";
import { getFeeBatch } from "@/lib/fund";
import { translator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function FeeBatchDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { club } = await loadClub();
  if (!club) notFound();
  const [batch, locale] = await Promise.all([getFeeBatch(club.id, id), getLocale()]);
  const t = translator(locale);
  if (!batch) notFound();
  const total = batch.months.reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className="flex flex-col gap-4 px-5 py-6">
      <section className="card flex flex-col gap-1 p-4">
        <p className="text-lg font-bold">{batch.memberName}</p>
        <p className="text-sm text-muted">
          {formatShortDate(batch.occurredOn)}
          {batch.description && ` · ${batch.description}`}
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {batch.months.map((m) => (
            <li key={m.month} className="flex justify-between">
              <span>{formatMonthLabel(m.month, locale)}</span>
              <span className="text-muted">{formatVnd(m.amount)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between border-t border-line pt-2 font-bold">
          <span>{t("Tổng")}</span>
          <span className="text-brand-700">{formatVnd(total)}</span>
        </p>
      </section>
      <form action={undoMemberFees.bind(null, id)}>
        <ConfirmButton
          message={t("Hoàn tác lần thu {amount} của {name}? Các tháng này về Chưa nộp.", {
            amount: formatVnd(total),
            name: batch.memberName,
          })}
          className="h-11 w-full rounded-full border border-red-200 text-sm font-semibold text-red-600"
        >
          {t("Hoàn tác lần thu này")}
        </ConfirmButton>
      </form>
    </div>
  );
}

export default function FeeBatchPage({ params }: PageProps<"/fund/batch/[id]">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Thu tiền sân" backHref="/fund" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <FeeBatchDetail params={params} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
