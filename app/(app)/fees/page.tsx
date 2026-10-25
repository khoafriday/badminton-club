import Link from "next/link";
import { Suspense } from "react";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { getPriceSettings, loadClub, todayInVietnam } from "@/lib/club";
import { addMonths, formatMonthLabel } from "@/lib/dates";
import { ensureFeeSlips, listFeeSlips, waiveFullMonthAbsences } from "@/lib/fees";
import { FeeList } from "./fee-list";

async function FeesContent({ searchParams }: { searchParams: PageProps<"/fees">["searchParams"] }) {
  const sp = await searchParams;
  const { club } = await loadClub();
  if (!club) return <NoClub />;

  const today = todayInVietnam();
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  await Promise.all([
    getPriceSettings(club.id).then((settings) => ensureFeeSlips(club.id, `${month}-01`, today, settings)),
    waiveFullMonthAbsences(club.id, today),
  ]);
  const slips = await listFeeSlips(club.id, `${month}-01`);

  return (
    <>
      <div className="card mx-5 flex items-center justify-between px-2 py-1">
        <Link
          href={`/fees?month=${addMonths(month, -1)}`}
          aria-label="Tháng trước"
          className="flex size-10 items-center justify-center text-2xl"
        >
          ‹
        </Link>
        <p className="font-bold">{formatMonthLabel(month)}</p>
        <Link
          href={`/fees?month=${addMonths(month, 1)}`}
          aria-label="Tháng sau"
          className="flex size-10 items-center justify-center text-2xl"
        >
          ›
        </Link>
      </div>
      {month > today.slice(0, 7) && (
        <p className="px-5 pt-3 text-sm text-muted">Phiếu của tháng này sẽ được tạo khi tháng bắt đầu.</p>
      )}
      <FeeList
        key={month}
        items={slips.map((s) => ({
          id: s.id,
          memberId: s.member_id,
          name: s.members.full_name,
          billingMode: s.billing_mode,
          amountDue: s.amount_due,
          status: s.payment_status,
          waiveReason: s.waive_reason,
        }))}
      />
      <p className="px-5 pt-4 text-xs text-muted">
        Hết tháng mà người cố định không đi buổi nào, phiếu chưa nộp tự chuyển sang Miễn.
      </p>
    </>
  );
}

export default function FeesPage({ searchParams }: PageProps<"/fees">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Phí tháng" backHref="/members" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <FeesContent searchParams={searchParams} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
